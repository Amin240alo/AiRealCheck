import os
import time

from Backend.deepfake_api import analyze_with_hive
from Backend.engines.engine_utils import make_engine_result


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def hive_health_check():
    if not _paid_apis_enabled():
        return {"ok": False, "status": "disabled", "message": "Paid APIs disabled"}
    enabled = os.getenv("HIVE_ENABLED", "true").lower() in {"1", "true", "yes"}
    key_id = (os.getenv("HIVE_API_KEY_ID") or "").strip()
    key_secret = (os.getenv("HIVE_API_SECRET") or "").strip()
    api_key = (os.getenv("HIVE_API_KEY") or "").strip()

    if not enabled:
        return {"ok": False, "status": "disabled", "message": "Hive disabled"}

    if not api_key and (not key_id or not key_secret):
        return {"ok": False, "status": "missing_key", "message": "Hive API key missing"}

    return {"ok": True, "status": "configured", "message": "Hive configured"}


def _ensure_api_key_env():
    api_key = (os.getenv("HIVE_API_KEY") or "").strip()
    if api_key:
        return api_key
    key_id = (os.getenv("HIVE_API_KEY_ID") or "").strip()
    key_secret = (os.getenv("HIVE_API_SECRET") or "").strip()
    if key_id and key_secret:
        api_key = f"{key_id}:{key_secret}"
        os.environ["HIVE_API_KEY"] = api_key
    return api_key


def run_hive(file_path: str):
    start = time.time()
    if not _paid_apis_enabled():
        return make_engine_result(
            engine="hive",
            status="disabled",
            notes="disabled:paid_apis_off",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["paid_apis_disabled"],
            start_time=start,
            extra={"warnings": ["Hive disabled via paid APIs switch."]},
        )
    health = hive_health_check()
    if not health["ok"]:
        status = "error"
        notes = "error"
        if health.get("status") == "missing_key":
            status = "not_available"
            notes = "not_available:missing_key"
        elif health.get("status") == "disabled":
            status = "disabled"
            notes = "disabled:hive_off"
        warnings = ["Hive nicht verbunden (API-Key/Authorization). Ergebnisse weniger verlaesslich."]
        return make_engine_result(
            engine="hive",
            status=status,
            notes=notes,
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["missing_key" if status == "not_available" else "api_error"],
            start_time=start,
            extra={
                "warnings": warnings,
                "message": health.get("message") or "Hive not available",
                "details": [health.get("message")],
            },
        )

    api_key = _ensure_api_key_env()
    debug = os.getenv("AIREALCHECK_DEBUG_RAW", "false").lower() in {"1", "true", "yes"}
    if debug and api_key:
        print(f"HIVE_API_KEY prefix: {api_key[:6]}...")

    result = analyze_with_hive(file_path)
    ok = bool(result) and not result.get("error") and result.get("real") is not None and result.get("fake") is not None
    if not ok:
        message = result.get("message") if isinstance(result, dict) else "Hive error"
        details = result.get("details", []) if isinstance(result, dict) else []
        return make_engine_result(
            engine="hive",
            status="error",
            notes=f"error:{message}" if message else "error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["api_error"],
            start_time=start,
            extra={
                "message": message,
                "details": details,
                "warnings": ["Hive nicht verbunden (API-Key/Authorization). Ergebnisse weniger verlaesslich."],
            },
        )

    payload = {
        "ok": bool(ok),
        "engine": "hive",
        "real": result.get("real"),
        "fake": result.get("fake"),
        "confidence": result.get("confidence"),
        "message": result.get("message"),
        "details": result.get("details", []),
        "warnings": [],
        "timing_ms": int((time.time() - start) * 1000),
    }
    return payload
