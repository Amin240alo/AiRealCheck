import os
import time

try:
    import torch
except Exception:
    torch = None

try:
    import numpy as np
except Exception:
    np = None

try:
    from PIL import Image, ImageOps
except Exception:
    Image = None
    ImageOps = None

open_clip = None
openai_clip = None
_CLIP_BACKEND = ""
_CLIP_IMPORT_ERROR = None

try:
    import open_clip as _open_clip

    open_clip = _open_clip
    _CLIP_BACKEND = "open_clip"
except Exception as exc:
    _CLIP_IMPORT_ERROR = str(exc)[:240]

if open_clip is None:
    try:
        import clip as _openai_clip

        openai_clip = _openai_clip
        _CLIP_BACKEND = "openai_clip"
        _CLIP_IMPORT_ERROR = None
    except Exception as exc:
        if _CLIP_IMPORT_ERROR is None:
            _CLIP_IMPORT_ERROR = str(exc)[:240]


ENGINE_NAME = "clip_detector"
_MODEL_CACHE = {"attempted": False, "model": None, "preprocess": None, "meta": None}
_EMBED_CACHE = {"entries": {}}


def _local_ml_enabled():
    return os.getenv("AIREALCHECK_USE_LOCAL_ML", "true").lower() in {"1", "true", "yes"}


def _clip_enabled():
    return os.getenv("AIREALCHECK_ENABLE_CLIP_DETECTOR", "false").lower() in {"1", "true", "yes"}


def _local_preprocess_enabled():
    return os.getenv("AIREALCHECK_IMAGE_LOCAL_PREPROCESS", "true").lower() in {"1", "true", "yes", "on"}


def _clamp01(value):
    try:
        v = float(value)
    except Exception:
        return 0.0
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _result(*, status, available, ai_likelihood, confidence, signals, notes, start_time, warning=None):
    payload = {
        "engine": ENGINE_NAME,
        "status": status,
        "available": bool(available),
        "ai_likelihood": ai_likelihood,
        "confidence": float(confidence),
        "signals": signals if isinstance(signals, list) else [],
        "notes": str(notes),
        "timing_ms": int((time.time() - start_time) * 1000),
    }
    if warning:
        payload["warning"] = str(warning)
    return payload


def _resolve_device():
    if torch is None:
        return "cpu"
    env = (os.getenv("AIREALCHECK_CLIP_DEVICE") or "").strip().lower()
    if env in {"cpu", "cuda", "mps"}:
        return env
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _resolve_embeddings_path():
    path = (os.getenv("AIREALCHECK_CLIP_EMBEDDINGS_PATH") or os.getenv("AIREALCHECK_CLIP_EMBEDDINGS") or "").strip()
    if path:
        return path
    return os.path.join("data", "clip_real_embeddings.npz")


def _load_base_image(path: str):
    if Image is None:
        raise RuntimeError("pillow_missing")
    with Image.open(path) as img:
        if ImageOps is not None:
            img = ImageOps.exif_transpose(img)
        img.load()
        if img.mode != "RGB":
            img = img.convert("RGB")
        return img.copy()


def _jpeg_recompress(img: Image.Image, quality: int = 85) -> Image.Image:
    from io import BytesIO

    buf = BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    buf.seek(0)
    with Image.open(buf) as tmp:
        tmp = tmp.convert("RGB")
        tmp.load()
        return tmp.copy()


def _resize_down_up_if_large(img: Image.Image, max_edge: int = 1024, downscale: float = 0.75):
    width, height = img.size
    if max(width, height) <= max_edge:
        return None
    down_w = max(1, int(round(width * downscale)))
    down_h = max(1, int(round(height * downscale)))
    down = img.resize((down_w, down_h), resample=Image.LANCZOS)
    up = down.resize((width, height), resample=Image.BICUBIC)
    return up


def _center_crop_resize(img: Image.Image, crop_scale: float = 0.9):
    width, height = img.size
    crop_w = max(1, int(round(width * crop_scale)))
    crop_h = max(1, int(round(height * crop_scale)))
    left = max(0, (width - crop_w) // 2)
    top = max(0, (height - crop_h) // 2)
    right = min(width, left + crop_w)
    bottom = min(height, top + crop_h)
    cropped = img.crop((left, top, right, bottom))
    return cropped.resize((width, height), resample=Image.LANCZOS)


def _build_variants(img: Image.Image):
    variants = [("orig", img)]
    if not _local_preprocess_enabled():
        return variants
    try:
        variants.append(("jpeg_q85", _jpeg_recompress(img, quality=85)))
    except Exception:
        pass
    try:
        resized = _resize_down_up_if_large(img, max_edge=1024, downscale=0.75)
        if resized is not None:
            variants.append(("resize_down_up", resized))
    except Exception:
        pass
    try:
        variants.append(("center_crop", _center_crop_resize(img, crop_scale=0.9)))
    except Exception:
        pass
    return variants


def _median(values):
    if not values:
        return None
    vals = sorted(values)
    mid = len(vals) // 2
    if len(vals) % 2 == 1:
        return vals[mid]
    return (vals[mid - 1] + vals[mid]) / 2.0


def _resolve_ai_embeddings_path():
    return (os.getenv("AIREALCHECK_CLIP_AI_EMBEDDINGS_PATH") or "").strip()


def _load_embeddings_cached(path):
    if not path:
        return None, 0, 0, "embeddings_path_missing"
    entry = _EMBED_CACHE.get("entries", {}).get(path)
    if entry and entry.get("embeddings") is not None:
        return entry["embeddings"], entry["count"], entry["dim"], None
    if np is None:
        return None, 0, 0, "numpy_missing"
    if not os.path.exists(path):
        return None, 0, 0, f"embeddings_missing:{path}"

    try:
        if path.lower().endswith(".npz"):
            data = np.load(path)
            if "embeddings" in data:
                arr = data["embeddings"]
            elif data.files:
                arr = data[data.files[0]]
            else:
                return None, 0, 0, "embeddings_empty"
        elif path.lower().endswith(".npy"):
            arr = np.load(path)
        elif path.lower().endswith((".pt", ".pth")):
            if torch is None:
                return None, 0, 0, "torch_missing"
            obj = torch.load(path, map_location="cpu")
            arr = None
            if isinstance(obj, dict):
                for key in ("embeddings", "features", "embs"):
                    if key in obj:
                        arr = obj[key]
                        break
                if arr is None:
                    for value in obj.values():
                        if hasattr(value, "shape"):
                            arr = value
                            break
            else:
                arr = obj
            if hasattr(arr, "detach"):
                arr = arr.detach().cpu().numpy()
        elif path.lower().endswith(".json"):
            import json

            with open(path, "r", encoding="utf-8") as f:
                arr = np.array(json.load(f), dtype=np.float32)
        else:
            return None, 0, 0, "unsupported_embeddings_format"
    except Exception as exc:
        return None, 0, 0, f"embeddings_load_failed:{str(exc)[:160]}"

    if arr is None:
        return None, 0, 0, "embeddings_empty"
    if not isinstance(arr, np.ndarray):
        arr = np.asarray(arr, dtype=np.float32)
    if arr.ndim == 1:
        arr = np.expand_dims(arr, axis=0)
    if arr.ndim != 2 or arr.shape[0] <= 0:
        return None, 0, 0, "embeddings_invalid_shape"

    arr = arr.astype(np.float32)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    arr = arr / norms

    _EMBED_CACHE.setdefault("entries", {})[path] = {
        "embeddings": arr,
        "count": int(arr.shape[0]),
        "dim": int(arr.shape[1]),
    }
    return arr, int(arr.shape[0]), int(arr.shape[1]), None


def _load_model_cached():
    if _MODEL_CACHE["attempted"]:
        return _MODEL_CACHE["model"], _MODEL_CACHE["preprocess"], _MODEL_CACHE["meta"] or {}

    _MODEL_CACHE["attempted"] = True

    if torch is None:
        meta = {"reason": "torch_missing"}
        _MODEL_CACHE["meta"] = meta
        return None, None, meta

    if not _CLIP_BACKEND:
        meta = {"reason": "clip_library_missing", "error": _CLIP_IMPORT_ERROR or "missing_open_clip_or_clip"}
        _MODEL_CACHE["meta"] = meta
        return None, None, meta

    model_name = (os.getenv("AIREALCHECK_CLIP_MODEL") or "ViT-B-32").strip() or "ViT-B-32"
    pretrained = (os.getenv("AIREALCHECK_CLIP_PRETRAINED") or "openai").strip() or "openai"
    device = _resolve_device()

    try:
        if _CLIP_BACKEND == "open_clip":
            out = open_clip.create_model_and_transforms(model_name, pretrained=pretrained)
            if isinstance(out, (list, tuple)) and len(out) >= 2:
                model = out[0]
                preprocess = out[-1]
            else:
                model, preprocess = out
            model = model.to(device)
        else:
            model, preprocess = openai_clip.load(model_name, device=device)
        model.eval()
    except Exception as exc:
        meta = {"reason": "model_load_failed", "error": str(exc)[:240], "backend": _CLIP_BACKEND}
        _MODEL_CACHE["meta"] = meta
        return None, None, meta

    meta = {
        "backend": _CLIP_BACKEND,
        "model": model_name,
        "pretrained": pretrained,
        "device": device,
    }
    _MODEL_CACHE.update({"model": model, "preprocess": preprocess, "meta": meta})
    return model, preprocess, meta


def _encode_image(model, preprocess, image_input, device):
    if Image is None:
        raise RuntimeError("pillow_missing")
    if torch is None:
        raise RuntimeError("torch_missing")
    if isinstance(image_input, Image.Image):
        image = image_input
    else:
        image = Image.open(image_input).convert("RGB")
    image_input = preprocess(image).unsqueeze(0)
    image_input = image_input.to(device)
    with torch.no_grad():
        if hasattr(model, "encode_image"):
            features = model.encode_image(image_input)
        elif hasattr(model, "get_image_features"):
            features = model.get_image_features(pixel_values=image_input)
        else:
            raise RuntimeError("encode_image_missing")
    if features.ndim == 1:
        features = features.unsqueeze(0)
    features = features / features.norm(dim=-1, keepdim=True)
    return features[0].detach().cpu().numpy().astype(np.float32)


def _score_from_similarity(similarity, sim_low, sim_high):
    if sim_high <= sim_low:
        sim_high = sim_low + 1e-6
    real_score = (similarity - sim_low) / (sim_high - sim_low)
    real_score = _clamp01(real_score)
    ai_prob = 1.0 - real_score
    mid = (sim_low + sim_high) / 2.0
    span = max(1e-6, (sim_high - sim_low) / 2.0)
    confidence = 0.5 + min(0.45, abs(similarity - mid) / span * 0.45)
    confidence = max(0.3, min(0.95, confidence))
    return ai_prob, confidence


def run_clip_detector(file_path: str):
    start = time.time()

    if not _clip_enabled():
        return _result(
            status="disabled",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["clip_disabled"],
            notes="disabled:clip_flag_off",
            start_time=start,
        )

    if not _local_ml_enabled():
        return _result(
            status="disabled",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["local_ml_disabled"],
            notes="disabled:local_ml_off",
            start_time=start,
        )

    if not file_path or not os.path.exists(file_path):
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes="file_missing",
            start_time=start,
        )

    if torch is None or np is None or Image is None:
        missing = []
        if torch is None:
            missing.append("torch_missing")
        if np is None:
            missing.append("numpy_missing")
        if Image is None:
            missing.append("pillow_missing")
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=missing,
            notes="deps_missing",
            start_time=start,
        )

    model, preprocess, meta = _load_model_cached()
    if model is None or preprocess is None:
        reason = meta.get("reason") or "model_unavailable"
        warning = meta.get("error") or ""
        signals = [f"backend:{meta.get('backend', '')}"] if meta.get("backend") else []
        if warning:
            signals.append(f"error:{warning}")
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=signals,
            notes=reason,
            start_time=start,
            warning=warning or None,
        )

    embeddings_path = _resolve_embeddings_path()
    embeddings, count, dim, embed_error = _load_embeddings_cached(embeddings_path)
    if embeddings is None:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[f"embeddings:{os.path.basename(embeddings_path)}"] if embeddings_path else [],
            notes=embed_error or "embeddings_unavailable",
            start_time=start,
        )

    ai_embeddings = None
    ai_count = 0
    ai_dim = 0
    ai_embeddings_path = _resolve_ai_embeddings_path()
    if ai_embeddings_path:
        ai_embeddings, ai_count, ai_dim, _ = _load_embeddings_cached(ai_embeddings_path)
        if ai_embeddings is None or int(ai_dim) != int(dim):
            ai_embeddings = None
            ai_count = 0

    device = meta.get("device") or _resolve_device()
    try:
        base_img = _load_base_image(file_path)
    except Exception as exc:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes="image_load_failed",
            start_time=start,
            warning=str(exc)[:240],
        )

    variants = _build_variants(base_img)
    topk = int(os.getenv("AIREALCHECK_CLIP_TOPK", "5") or 5)
    if topk <= 0:
        topk = 1

    sim_low = float(os.getenv("AIREALCHECK_CLIP_SIM_LOW", "0.18") or 0.18)
    sim_high = float(os.getenv("AIREALCHECK_CLIP_SIM_HIGH", "0.32") or 0.32)

    def _score_embedding(image_emb):
        if image_emb is None or image_emb.ndim != 1:
            return None, None, None, None, None
        if int(image_emb.shape[0]) != int(dim):
            return None, None, None, None, None

        real_similarities = embeddings.dot(image_emb)
        if real_similarities.size == 0:
            return None, None, None, None, None

        if real_similarities.size <= topk:
            real_top_sims = real_similarities
        else:
            idx = np.argpartition(real_similarities, -topk)[-topk:]
            real_top_sims = real_similarities[idx]

        sim_real_topk_mean = float(np.mean(real_top_sims))
        ai_prob, confidence = _score_from_similarity(sim_real_topk_mean, sim_low, sim_high)
        ai_prob_soft = None
        sim_ai_topk_mean = None

        if ai_embeddings is not None and ai_embeddings.size > 0:
            ai_similarities = ai_embeddings.dot(image_emb)
            if ai_similarities.size > 0:
                if ai_similarities.size <= topk:
                    ai_top_sims = ai_similarities
                else:
                    idx = np.argpartition(ai_similarities, -topk)[-topk:]
                    ai_top_sims = ai_similarities[idx]
                sim_ai_topk_mean = float(np.mean(ai_top_sims))
                ai_score = sim_ai_topk_mean - sim_real_topk_mean
                ai_prob = _clamp01(0.5 + ai_score * 2.0)
                ai_prob_soft = _clamp01(0.5 + (ai_prob - 0.5) * 0.70)
                if abs(ai_score) >= 0.08:
                    boost = min(0.10, (abs(ai_score) - 0.08) * 0.8)
                    confidence = min(0.85, confidence + boost)

        ai_prob_out = ai_prob_soft if ai_prob_soft is not None else ai_prob
        return ai_prob_out, confidence, sim_real_topk_mean, sim_ai_topk_mean, ai_prob_soft

    variant_scores = []
    variant_confidences = []
    sim_real_means = []
    sim_ai_means = []
    soft_scores = []

    for _name, img in variants:
        try:
            image_emb = _encode_image(model, preprocess, img, device)
        except Exception:
            continue
        ai_score, conf, sim_real_mean, sim_ai_mean, ai_prob_soft = _score_embedding(image_emb)
        if ai_score is None:
            continue
        variant_scores.append(float(ai_score))
        variant_confidences.append(float(conf))
        if sim_real_mean is not None:
            sim_real_means.append(sim_real_mean)
        if sim_ai_mean is not None:
            sim_ai_means.append(sim_ai_mean)
        if ai_prob_soft is not None:
            soft_scores.append(ai_prob_soft)

    if not variant_scores:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes="embedding_failed",
            start_time=start,
        )

    ai_prob_out = _median(variant_scores)
    if ai_prob_out is None:
        ai_prob_out = variant_scores[0]

    conf_out = _median(variant_confidences)
    if conf_out is None:
        conf_out = max(ai_prob_out, 1.0 - ai_prob_out)

    mean_val = sum(variant_scores) / float(len(variant_scores))
    variance = sum((x - mean_val) ** 2 for x in variant_scores) / float(len(variant_scores))
    variant_stddev = variance ** 0.5
    variant_range = max(variant_scores) - min(variant_scores)

    if count < 50:
        conf_out = min(conf_out, 0.55)
    elif count < 200:
        conf_out = min(conf_out, 0.7)
    conf_out = min(conf_out, 0.85)

    if variant_stddev >= 0.10:
        conf_out = max(0.30, conf_out * 0.65)
    elif variant_stddev >= 0.05:
        conf_out = max(0.35, conf_out * 0.80)

    signals = [f"model:{meta.get('model', 'clip')}"]
    sim_real_topk_mean = sum(sim_real_means) / float(len(sim_real_means)) if sim_real_means else None
    sim_ai_topk_mean = sum(sim_ai_means) / float(len(sim_ai_means)) if sim_ai_means else None
    ai_prob_soft = _median(soft_scores) if soft_scores else None
    if sim_real_topk_mean is not None:
        signals.append(f"real_mean:{sim_real_topk_mean:.4f}")
    if sim_ai_topk_mean is not None:
        signals.append(f"ai_mean:{sim_ai_topk_mean:.4f}")
        delta = sim_ai_topk_mean - sim_real_topk_mean
        signals.append(f"delta:{delta:.4f};delta_abs:{abs(delta):.4f}")
    if ai_prob_soft is not None:
        signals.append(f"soft:{ai_prob_soft:.4f}")
    signals.append(f"real_n:{count};ai_n:{ai_count}")

    notes = f"ok;variants={len(variant_scores)};variant_stddev={variant_stddev:.4f}"

    return _result(
        status="ok",
        available=True,
        ai_likelihood=ai_prob_out * 100.0,
        confidence=_clamp01(conf_out),
        signals=signals[:6],
        notes=notes,
        start_time=start,
    )
