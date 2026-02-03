import os
import time

from Backend.deepfake_api import analyze_with_hive


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
        return {
            "ok": False,
            "engine": "hive",
            "error": True,
            "message": "Hive disabled (paid APIs off)",
            "details": ["Hive disabled (AIREALCHECK_USE_PAID_APIS=false)"],
            "warnings": ["Hive disabled via paid APIs switch."],
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": ["paid_apis_disabled"],
            "notes": "disabled:paid_apis_off",
            "available": False,
            "status": "disabled",
            "timing_ms": int((time.time() - start) * 1000),
        }
    health = hive_health_check()
    if not health["ok"]:
        return {
            "ok": False,
            "engine": "hive",
            "error": True,
            "message": "Hive not available",
            "details": [health["message"]],
            "warnings": ["Hive nicht verbunden (API-Key/Authorization). Ergebnisse weniger verlässlich."],
            "timing_ms": int((time.time() - start) * 1000),
        }

    api_key = _ensure_api_key_env()
    debug = os.getenv("AIREALCHECK_DEBUG_RAW", "false").lower() in {"1", "true", "yes"}
    if debug and api_key:
        print(f"HIVE_API_KEY prefix: {api_key[:6]}...")

    result = analyze_with_hive(file_path)
    ok = bool(result) and not result.get("error") and result.get("real") is not None and result.get("fake") is not None
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
    if not ok:
        payload["error"] = True
        payload["warnings"].append("Hive nicht verbunden (API-Key/Authorization). Ergebnisse weniger verlässlich.")
    return payload
