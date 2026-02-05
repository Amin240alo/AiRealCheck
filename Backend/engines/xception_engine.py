import os
import time

from Backend import deepfake_model


def _local_ml_enabled():
    return os.getenv("AIREALCHECK_USE_LOCAL_ML", "true").lower() in {"1", "true", "yes"}


def _torch_available():
    return deepfake_model.torch is not None and deepfake_model.timm is not None and deepfake_model.transforms is not None


def _disabled():
    return {
        "engine": "xception",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": ["local_ml_disabled"],
        "notes": "disabled:local_ml_off",
        "available": False,
        "status": "disabled",
    }


def _not_available(notes="not_available", signals=None):
    return {
        "engine": "xception",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": signals or [],
        "notes": notes,
        "available": False,
        "status": "not_available",
    }


def _normalize_ai01(value):
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = v / 100.0 if v <= 100.0 else 1.0
    if v > 1.0:
        v = 1.0
    return v


def _extract_ai_value(result):
    if not isinstance(result, dict):
        return None
    if "fake" in result:
        try:
            return _normalize_ai01(float(result.get("fake")) / 100.0)
        except Exception:
            return None
    if "real" in result:
        try:
            real_value = float(result.get("real"))
        except Exception:
            return None
        ai_value = 1.0 - (real_value / 100.0)
        return _normalize_ai01(ai_value)
    for key in ("ai_likelihood", "fake_score", "score"):
        if key in result:
            return _normalize_ai01(result.get(key))
    return None


def run_xception(file_path: str):
    start = time.time()
    if not _local_ml_enabled():
        return _disabled()
    if not _torch_available():
        return _not_available("torch_missing", signals=["torch_missing"])

    try:
        result = deepfake_model.analyze_with_xception(file_path)
        print("[xception raw result]", result)
    except Exception:
        return _not_available("error", signals=["exception"])

    if not isinstance(result, dict):
        return _not_available("invalid_result", signals=["invalid_result"])

    ai_value = _extract_ai_value(result)
    if ai_value is None:
        return _not_available("no_score", signals=["no_score"])

    confidence = max(ai_value, 1.0 - ai_value)
    signals = ["model:xception", f"ai:{ai_value:.3f}"]
    details = result.get("details")
    if isinstance(details, list):
        signals.extend([str(d) for d in details if d is not None])
    elif details:
        signals.append(str(details))
    message = result.get("message")
    if isinstance(message, str) and message.strip():
        signals.append(message.strip())

    payload = {
        "engine": "xception",
        "ai_likelihood": ai_value * 100.0,
        "confidence": confidence,
        "signals": signals[:6],
        "notes": "ok",
        "available": True,
        "status": "ok",
        "timing_ms": int((time.time() - start) * 1000),
    }
    return payload
