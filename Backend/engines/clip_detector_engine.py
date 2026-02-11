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
    from PIL import Image
except Exception:
    Image = None

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


def _encode_image(model, preprocess, image_path, device):
    if Image is None:
        raise RuntimeError("pillow_missing")
    if torch is None:
        raise RuntimeError("torch_missing")
    image = Image.open(image_path).convert("RGB")
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
        image_emb = _encode_image(model, preprocess, file_path, device)
    except Exception as exc:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes="embedding_failed",
            start_time=start,
            warning=str(exc)[:240],
        )

    if image_emb is None or image_emb.ndim != 1:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes="embedding_invalid",
            start_time=start,
        )

    if int(image_emb.shape[0]) != int(dim):
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[f"embed_dim:{image_emb.shape[0]}", f"ref_dim:{dim}"],
            notes="embedding_dim_mismatch",
            start_time=start,
        )

    real_similarities = embeddings.dot(image_emb)
    if real_similarities.size == 0:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes="embeddings_empty",
            start_time=start,
        )

    topk = int(os.getenv("AIREALCHECK_CLIP_TOPK", "5") or 5)
    if topk <= 0:
        topk = 1
    if real_similarities.size <= topk:
        real_top_sims = real_similarities
    else:
        idx = np.argpartition(real_similarities, -topk)[-topk:]
        real_top_sims = real_similarities[idx]

    sim_real_topk_mean = float(np.mean(real_top_sims))
    sim_real_topk_max = float(np.max(real_top_sims))

    sim_low = float(os.getenv("AIREALCHECK_CLIP_SIM_LOW", "0.18") or 0.18)
    sim_high = float(os.getenv("AIREALCHECK_CLIP_SIM_HIGH", "0.32") or 0.32)
    ai_prob, confidence = _score_from_similarity(sim_real_topk_mean, sim_low, sim_high)
    ai_prob_soft = None

    sim_ai_topk_mean = None
    sim_ai_topk_max = None
    if ai_embeddings is not None:
        ai_similarities = ai_embeddings.dot(image_emb)
        if ai_similarities.size > 0:
            if ai_similarities.size <= topk:
                ai_top_sims = ai_similarities
            else:
                idx = np.argpartition(ai_similarities, -topk)[-topk:]
                ai_top_sims = ai_similarities[idx]
            sim_ai_topk_mean = float(np.mean(ai_top_sims))
            sim_ai_topk_max = float(np.max(ai_top_sims))
            ai_score = sim_ai_topk_mean - sim_real_topk_mean
            ai_prob = _clamp01(0.5 + ai_score * 2.0)
            ai_prob_soft = _clamp01(0.5 + (ai_prob - 0.5) * 0.70)
            if abs(ai_score) >= 0.08:
                boost = min(0.10, (abs(ai_score) - 0.08) * 0.8)
                confidence = min(0.85, confidence + boost)
        else:
            ai_embeddings = None
            ai_count = 0

    if count < 50:
        confidence = min(confidence, 0.55)
    elif count < 200:
        confidence = min(confidence, 0.7)
    confidence = min(confidence, 0.85)

    signals = [f"model:{meta.get('model', 'clip')}"]
    if sim_real_topk_mean is not None:
        signals.append(f"real_mean:{sim_real_topk_mean:.4f}")
    if sim_ai_topk_mean is not None:
        signals.append(f"ai_mean:{sim_ai_topk_mean:.4f}")
        delta = sim_ai_topk_mean - sim_real_topk_mean
        signals.append(f"delta:{delta:.4f};delta_abs:{abs(delta):.4f}")
    if ai_prob_soft is not None:
        signals.append(f"soft:{ai_prob_soft:.4f}")
    signals.append(f"real_n:{count};ai_n:{ai_count}")

    ai_prob_out = ai_prob_soft if ai_prob_soft is not None else ai_prob

    return _result(
        status="ok",
        available=True,
        ai_likelihood=ai_prob_out * 100.0,
        confidence=_clamp01(confidence),
        signals=signals[:6],
        notes="ok",
        start_time=start,
    )
