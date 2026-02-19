import os
import time
import traceback


def make_engine_result(
    engine,
    status,
    notes,
    available,
    ai_likelihood=None,
    confidence=0.0,
    signals=None,
    extra=None,
    timing_ms=None,
    start_time=None,
):
    result = {
        "engine": str(engine),
        "status": str(status),
        "notes": "" if notes is None else str(notes),
        "available": bool(available),
        "ai_likelihood": ai_likelihood,
        "confidence": float(confidence) if confidence is not None else 0.0,
        "signals": signals if isinstance(signals, list) else [],
    }
    if timing_ms is None and start_time is not None:
        try:
            timing_ms = int((time.time() - start_time) * 1000)
        except Exception:
            timing_ms = None
    if timing_ms is not None:
        result["timing_ms"] = int(timing_ms)
    if isinstance(extra, dict):
        result.update(extra)
    return result


def coerce_engine_result(raw, engine, start_time=None):
    if not isinstance(raw, dict):
        return make_engine_result(
            engine=engine,
            status="error",
            notes="invalid_result",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["invalid_result"],
            start_time=start_time,
        )
    result = dict(raw)
    result["engine"] = result.get("engine") or engine
    if result.get("status") is None:
        result["status"] = "ok" if result.get("available") else "error"
    if result.get("notes") is None:
        result["notes"] = "ok" if result.get("available") else "not_available"
    if result.get("available") is None:
        result["available"] = False
    if "ai_likelihood" not in result:
        result["ai_likelihood"] = None
    if "confidence" not in result:
        result["confidence"] = 0.0
    if "signals" not in result:
        result["signals"] = []
    if "timing_ms" not in result and start_time is not None:
        try:
            result["timing_ms"] = int((time.time() - start_time) * 1000)
        except Exception:
            pass
    return result


def safe_engine_call(engine_name, fn, *args, **kwargs):
    start = time.time()
    try:
        result = fn(*args, **kwargs)
    except Exception as exc:
        if os.getenv("AIREALCHECK_DEBUG", "0").lower() in {"1", "true", "yes", "on"}:
            traceback.print_exc()
        return make_engine_result(
            engine=engine_name,
            status="error",
            notes=f"exception:{type(exc).__name__}:{str(exc)[:160]}",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["exception"],
            start_time=start,
        )
    return coerce_engine_result(result, engine_name, start_time=start)
