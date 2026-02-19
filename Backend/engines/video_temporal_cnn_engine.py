import os
import time

try:
    import torch
except Exception:
    torch = None

try:
    import torch.nn as nn
except Exception:
    nn = None

try:
    import numpy as np
except Exception:
    np = None

try:
    import cv2
except Exception:
    cv2 = None

try:
    from torchvision.models import video as tv_video
except Exception as exc:
    tv_video = None
    _TV_IMPORT_ERROR = str(exc)[:240]
else:
    _TV_IMPORT_ERROR = None

from Backend.engines.video_forensics_engine import extract_video_frames
from Backend.engines.engine_utils import make_engine_result

ENGINE_NAME = "video_temporal_cnn"
_MODEL_CACHE = {"attempted": False, "model": None, "meta": None}

_DEFAULT_MEAN = [0.43216, 0.394666, 0.37645]
_DEFAULT_STD = [0.22803, 0.22145, 0.216989]


def _local_ml_enabled():
    return os.getenv("AIREALCHECK_USE_LOCAL_ML", "true").lower() in {"1", "true", "yes"}


def _cnn_enabled():
    return os.getenv("AIREALCHECK_ENABLE_VIDEO_TEMPORAL_CNN", "true").lower() in {"1", "true", "yes"}


def _result(*, status, available, ai_likelihood, confidence, signals, notes, start_time, warning=None):
    payload = make_engine_result(
        engine=ENGINE_NAME,
        status=status,
        notes=notes,
        available=available,
        ai_likelihood=ai_likelihood,
        confidence=confidence,
        signals=signals,
        start_time=start_time,
    )
    if warning:
        payload["warning"] = str(warning)
    return payload


def _parse_float_list(raw, default):
    if not raw:
        return list(default)
    parts = str(raw).replace(";", ",").split(",")
    values = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        try:
            values.append(float(part))
        except Exception:
            pass
    if len(values) != 3:
        return list(default)
    return values


def _resolve_mean_std():
    mean = _parse_float_list(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_MEAN", ""), _DEFAULT_MEAN)
    std = _parse_float_list(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_STD", ""), _DEFAULT_STD)
    return mean, std


def _resolve_device():
    if torch is None:
        return "cpu"
    env = (os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_DEVICE") or "").strip().lower()
    if env in {"cpu", "cuda", "mps"}:
        if env == "cuda" and not torch.cuda.is_available():
            return "cpu"
        if env == "mps":
            mps = getattr(torch.backends, "mps", None)
            if mps is None or not mps.is_available():
                return "cpu"
        return env
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _resolve_model_path():
    return (
        os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_MODEL_PATH")
        or os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_WEIGHTS")
        or ""
    ).strip()


def _resolve_model_format(path):
    fmt = (os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_FORMAT") or "").strip().lower()
    if fmt in {"torchscript", "jit"}:
        return "torchscript"
    if fmt in {"state_dict", "weights"}:
        return "state_dict"
    lower = (path or "").lower()
    if lower.endswith(".jit") or lower.endswith(".torchscript"):
        return "torchscript"
    return "state_dict"


def _resolve_num_classes():
    try:
        value = int(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_NUM_CLASSES", "2"))
    except Exception:
        value = 2
    return max(1, value)


def _resolve_ai_index():
    try:
        value = int(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_AI_INDEX", "1"))
    except Exception:
        value = 1
    return max(0, value)


def _resolve_strict():
    return os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_STRICT", "true").lower() in {"1", "true", "yes"}


def _resolve_frame_count():
    try:
        value = int(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_FRAMES", "16"))
    except Exception:
        value = 16
    return max(4, value)


def _resolve_input_size():
    try:
        value = int(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_SIZE", "112"))
    except Exception:
        value = 112
    return max(64, min(320, value))


def _resolve_scan_fps():
    try:
        value = float(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_SCAN_FPS", "2.0"))
    except Exception:
        value = 2.0
    return max(0.0, value)


def _resolve_timeout_sec():
    try:
        value = float(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_TIMEOUT_SEC", "25"))
    except Exception:
        value = 25.0
    return max(5.0, value)


def _resolve_max_frames(target_frames):
    fallback = max(target_frames * 2, target_frames + 4)
    try:
        value = int(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_MAX_FRAMES", str(fallback)))
    except Exception:
        value = fallback
    return max(target_frames, value)


def _resolve_clip_strategy():
    strategy = (os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_CLIP_STRATEGY") or "center").strip().lower()
    if strategy not in {"center", "start", "end"}:
        strategy = "center"
    return strategy


def _coerce_state_dict(state):
    obj = state
    if isinstance(obj, dict):
        for key in ("state_dict", "model_state", "model", "net", "weights"):
            if key in obj and isinstance(obj[key], dict):
                obj = obj[key]
                break
    if hasattr(obj, "state_dict"):
        try:
            obj = obj.state_dict()
        except Exception:
            pass
    if not isinstance(obj, dict):
        return None
    cleaned = {}
    for key, value in obj.items():
        if not isinstance(key, str):
            continue
        k = key
        if k.startswith("module."):
            k = k[len("module."):]
        if k.startswith("model."):
            k = k[len("model."):]
        cleaned[k] = value
    return cleaned


def _create_model(arch, num_classes):
    if torch is None:
        return None, "torch_missing"
    if tv_video is None:
        reason = "torchvision_missing"
        if _TV_IMPORT_ERROR:
            reason = f"torchvision_missing:{_TV_IMPORT_ERROR}"
        return None, reason
    factory = getattr(tv_video, arch, None)
    if factory is None:
        return None, f"unknown_arch:{arch}"
    try:
        model = factory(weights=None)
    except TypeError:
        try:
            model = factory(pretrained=False)
        except Exception:
            model = factory()
    if hasattr(model, "fc") and nn is not None and num_classes is not None:
        try:
            in_features = model.fc.in_features
            model.fc = nn.Linear(in_features, num_classes)
        except Exception:
            pass
    return model, None


def _load_model_cached():
    if _MODEL_CACHE["attempted"]:
        return _MODEL_CACHE.get("model"), _MODEL_CACHE.get("meta") or {}
    _MODEL_CACHE["attempted"] = True
    meta = {}
    if torch is None:
        meta["reason"] = "torch_missing"
        _MODEL_CACHE["meta"] = meta
        return None, meta

    path = _resolve_model_path()
    if not path:
        meta["reason"] = "model_path_missing"
        _MODEL_CACHE["meta"] = meta
        return None, meta
    if not os.path.exists(path):
        meta["reason"] = "model_missing"
        meta["path"] = path
        _MODEL_CACHE["meta"] = meta
        return None, meta

    fmt = _resolve_model_format(path)
    device = _resolve_device()
    meta.update({"format": fmt, "device": device, "path": path})

    model = None
    if fmt == "torchscript":
        try:
            model = torch.jit.load(path, map_location=device)
        except Exception as exc:
            meta["reason"] = "model_load_failed"
            meta["error"] = str(exc)[:240]
            _MODEL_CACHE["meta"] = meta
            return None, meta
    else:
        arch = (os.getenv("AIREALCHECK_VIDEO_TEMPORAL_CNN_ARCH") or "r3d_18").strip() or "r3d_18"
        num_classes = _resolve_num_classes()
        model, err = _create_model(arch, num_classes)
        if model is None:
            meta["reason"] = err or "model_create_failed"
            _MODEL_CACHE["meta"] = meta
            return None, meta
        meta["arch"] = arch
        meta["num_classes"] = num_classes
        try:
            state = torch.load(path, map_location="cpu")
        except Exception as exc:
            meta["reason"] = "weights_load_failed"
            meta["error"] = str(exc)[:240]
            _MODEL_CACHE["meta"] = meta
            return None, meta
        state_dict = _coerce_state_dict(state)
        if not state_dict:
            meta["reason"] = "state_dict_missing"
            _MODEL_CACHE["meta"] = meta
            return None, meta
        strict = _resolve_strict()
        try:
            load_info = model.load_state_dict(state_dict, strict=strict)
        except Exception as exc:
            meta["reason"] = "state_dict_load_failed"
            meta["error"] = str(exc)[:240]
            _MODEL_CACHE["meta"] = meta
            return None, meta
        if load_info is not None:
            missing = getattr(load_info, "missing_keys", None)
            unexpected = getattr(load_info, "unexpected_keys", None)
            if missing:
                meta["missing_keys"] = list(missing)[:8]
            if unexpected:
                meta["unexpected_keys"] = list(unexpected)[:8]

    try:
        if hasattr(model, "to"):
            model = model.to(device)
    except Exception:
        pass
    try:
        model.eval()
    except Exception:
        pass

    _MODEL_CACHE["model"] = model
    _MODEL_CACHE["meta"] = meta
    return model, meta


def _extract_frames_cv2(file_path, max_frames):
    if cv2 is None:
        return [], {"note": "opencv_missing", "frames_extracted_count": 0, "method": "cv2"}
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        return [], {"note": "cv2_open_failed", "frames_extracted_count": 0, "method": "cv2"}
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total > 0 and total > max_frames:
            start = max(0, (total - max_frames) // 2)
            cap.set(cv2.CAP_PROP_POS_FRAMES, start)
        frames = []
        while len(frames) < max_frames:
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            frames.append(frame)
        return frames, {"note": "ok", "frames_extracted_count": len(frames), "method": "cv2"}
    finally:
        cap.release()


def _select_clip(frames, count, strategy):
    if len(frames) < count:
        return None
    if strategy == "start":
        start = 0
    elif strategy == "end":
        start = max(0, len(frames) - count)
    else:
        start = max(0, (len(frames) - count) // 2)
    return frames[start : start + count]


def _prepare_clip(frames, size, mean, std):
    if np is None or cv2 is None or torch is None:
        return None
    mean_arr = np.array(mean, dtype=np.float32).reshape(1, 1, 3)
    std_arr = np.array(std, dtype=np.float32).reshape(1, 1, 3)
    tensors = []
    for frame in frames:
        if isinstance(frame, (str, os.PathLike)):
            img = cv2.imread(str(frame))
            if img is None:
                return None
        else:
            img = frame
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        rgb = cv2.resize(rgb, (size, size), interpolation=cv2.INTER_AREA)
        arr = rgb.astype(np.float32) / 255.0
        arr = (arr - mean_arr) / std_arr
        tensor = torch.from_numpy(arr).permute(2, 0, 1)
        tensors.append(tensor)
    if not tensors:
        return None
    clip = torch.stack(tensors, dim=0).permute(1, 0, 2, 3)
    return clip.unsqueeze(0)


def _confidence_from_prob(prob):
    prob = max(0.0, min(1.0, float(prob)))
    conf = 0.3 + (abs(prob - 0.5) * 1.4)
    return max(0.3, min(0.85, conf))


def run_video_temporal_cnn(file_path: str):
    start = time.time()

    if not _cnn_enabled():
        return _result(
            status="disabled",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["cnn_disabled"],
            notes="disabled:flag_off",
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
            signals=["file_missing"],
            notes="file_missing",
            start_time=start,
        )

    missing = []
    if torch is None:
        missing.append("torch_missing")
    if np is None:
        missing.append("numpy_missing")
    if cv2 is None:
        missing.append("opencv_missing")
    if missing:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=missing,
            notes="deps_missing",
            start_time=start,
        )

    model, meta = _load_model_cached()
    if model is None:
        reason = meta.get("reason") or "model_unavailable"
        status = "not_available" if reason in {"model_path_missing", "model_missing"} else "error"
        signals = []
        if reason:
            signals.append(reason)
        if meta.get("path"):
            signals.append(f"model:{os.path.basename(meta['path'])}")
        warning = meta.get("error")
        if warning:
            signals.append(f"error:{warning}")
        return _result(
            status=status,
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=signals[:6],
            notes=reason,
            start_time=start,
            warning=warning,
        )

    target_frames = _resolve_frame_count()
    max_frames = _resolve_max_frames(target_frames)
    scan_fps = _resolve_scan_fps()
    timeout_sec = _resolve_timeout_sec()

    frames, extract_meta = extract_video_frames(file_path, max_frames, scan_fps, timeout_sec)
    extractor = extract_meta.get("method", "ffmpeg")
    if len(frames) < target_frames and cv2 is not None:
        cv2_frames, cv2_meta = _extract_frames_cv2(file_path, max_frames)
        if len(cv2_frames) > len(frames):
            frames = cv2_frames
            extract_meta = cv2_meta
            extractor = cv2_meta.get("method", "cv2")

    frames_extracted = int(extract_meta.get("frames_extracted_count") or len(frames))
    if len(frames) < target_frames:
        signals = [
            f"frames_extracted:{frames_extracted}",
            f"frames_required:{target_frames}",
            f"extractor:{extractor}",
        ]
        return _result(
            status="ok",
            available=True,
            ai_likelihood=None,
            confidence=0.0,
            signals=signals[:6],
            notes="insufficient_frames",
            start_time=start,
        )

    strategy = _resolve_clip_strategy()
    clip_frames = _select_clip(frames, target_frames, strategy)
    if clip_frames is None:
        signals = [
            f"frames_extracted:{frames_extracted}",
            f"frames_required:{target_frames}",
            f"extractor:{extractor}",
        ]
        return _result(
            status="ok",
            available=True,
            ai_likelihood=None,
            confidence=0.0,
            signals=signals[:6],
            notes="insufficient_frames",
            start_time=start,
        )

    size = _resolve_input_size()
    mean, std = _resolve_mean_std()
    clip_tensor = _prepare_clip(clip_frames, size, mean, std)
    if clip_tensor is None:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["frame_preprocess_failed"],
            notes="frame_preprocess_failed",
            start_time=start,
        )

    device = meta.get("device") or _resolve_device()
    try:
        clip_tensor = clip_tensor.to(device)
    except Exception:
        pass

    try:
        with torch.no_grad():
            output = model(clip_tensor)
    except Exception as exc:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["inference_failed"],
            notes="inference_failed",
            start_time=start,
            warning=str(exc)[:240],
        )

    if isinstance(output, dict):
        if "logits" in output:
            output = output["logits"]
        elif "output" in output:
            output = output["output"]
    if isinstance(output, (list, tuple)):
        output = output[0]

    if not torch.is_tensor(output):
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["invalid_output"],
            notes="invalid_output",
            start_time=start,
        )

    if output.ndim == 1:
        output = output.unsqueeze(0)

    ai_prob = None
    if output.shape[1] == 1:
        ai_prob = float(torch.sigmoid(output[0, 0]).item())
    else:
        ai_index = _resolve_ai_index()
        if ai_index >= output.shape[1]:
            return _result(
                status="error",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=[f"ai_index_oob:{ai_index}"],
                notes="ai_index_oob",
                start_time=start,
            )
        probs = torch.softmax(output, dim=1)
        ai_prob = float(probs[0, ai_index].item())

    if ai_prob is None:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["ai_prob_missing"],
            notes="ai_prob_missing",
            start_time=start,
        )

    ai_prob = max(0.0, min(1.0, ai_prob))
    confidence = _confidence_from_prob(ai_prob)
    arch_label = meta.get("arch") or ("torchscript" if meta.get("format") == "torchscript" else "model")
    signals = [
        f"frames_used:{len(clip_frames)}",
        f"frames_extracted:{frames_extracted}",
        f"extractor:{extractor}",
        f"arch:{arch_label}",
        f"device:{device}",
        f"ai_prob:{ai_prob:.3f}",
    ]

    return _result(
        status="ok",
        available=True,
        ai_likelihood=ai_prob * 100.0,
        confidence=confidence,
        signals=signals[:6],
        notes="ok",
        start_time=start,
    )
