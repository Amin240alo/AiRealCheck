import os
import time

import requests


_API_URL = "https://api.sightengine.com/1.0/check.json"


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _paid_api_timeouts():
    connect = float(os.getenv("AIREALCHECK_PAID_API_CONNECT_TIMEOUT_SEC", "8"))
    read = float(os.getenv("AIREALCHECK_PAID_API_READ_TIMEOUT_SEC", "25"))
    return connect, read


def _debug_paid_enabled():
    return os.getenv("AIREALCHECK_DEBUG_PAID", "0").lower() in {"1", "true", "yes", "on"}


def _debug_paid_log(paid_enabled, creds_present, env_names, path):
    if not _debug_paid_enabled():
        return
    env_list = ",".join(env_names)
    print(
        "[paid_debug] engine=sightengine "
        f"paid_apis_enabled={paid_enabled} creds_present={creds_present} "
        f"envs=[{env_list}] path={path}"
    )


def _parse_api_credentials():
    api_user = (os.getenv("SIGHTENGINE_API_USER") or "").strip()
    api_secret = (os.getenv("SIGHTENGINE_API_SECRET") or "").strip()
    if api_user and api_secret:
        return api_user, api_secret

    api_key = (os.getenv("SIGHTENGINE_API_KEY") or "").strip()
    if api_key:
        if ":" in api_key:
            parts = api_key.split(":", 1)
        elif "," in api_key:
            parts = api_key.split(",", 1)
        else:
            parts = [api_key, ""]
        api_user = parts[0].strip()
        api_secret = parts[1].strip() if len(parts) > 1 else ""
    return api_user, api_secret


def _not_available():
    return {
        "engine": "sightengine",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": [],
        "notes": "error:RuntimeError",
        "available": False,
        "status": "not_available",
    }


def _disabled():
    return {
        "engine": "sightengine",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": ["paid_apis_disabled"],
        "notes": "disabled:flag_off",
        "available": False,
        "status": "disabled",
    }


def _disabled_missing_key():
    return {
        "engine": "sightengine",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": ["missing_credentials"],
        "notes": "not_available:missing_credentials",
        "available": False,
        "status": "not_available",
    }


def _error(notes="error:RuntimeError"):
    return {
        "engine": "sightengine",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": ["api_error"],
        "notes": notes,
        "available": False,
        "status": "error",
    }


def run_sightengine(file_path: str):
    start = time.time()
    paid_enabled = _paid_apis_enabled()
    api_user, api_secret = _parse_api_credentials()
    creds_present = bool(api_user and api_secret)
    env_names = [
        "AIREALCHECK_USE_PAID_APIS",
        "SIGHTENGINE_API_USER",
        "SIGHTENGINE_API_SECRET",
        "SIGHTENGINE_API_KEY",
    ]
    if not paid_enabled:
        _debug_paid_log(paid_enabled, creds_present, env_names, "disabled:flag_off")
        return _disabled()
    if not creds_present:
        _debug_paid_log(paid_enabled, creds_present, env_names, "disabled:missing_credentials")
        return _disabled_missing_key()
    _debug_paid_log(paid_enabled, creds_present, env_names, "request")

    try:
        with open(file_path, "rb") as f:
            files = {"media": f}
            data = {
                "models": "genai",
                "api_user": api_user,
                "api_secret": api_secret,
            }
            resp = requests.post(_API_URL, files=files, data=data, timeout=_paid_api_timeouts())
    except Exception as exc:
        return _error(f"error:{type(exc).__name__}")

    if resp.status_code != 200:
        return _error(f"error:{resp.status_code}")

    try:
        payload = resp.json()
    except Exception as exc:
        return _error(f"error:{type(exc).__name__}")

    if payload.get("status") != "success":
        return _error("error:RuntimeError")

    ai_generated = None
    type_block = payload.get("type") if isinstance(payload.get("type"), dict) else {}
    if "ai_generated" in type_block:
        try:
            ai_generated = float(type_block.get("ai_generated"))
        except Exception:
            ai_generated = None

    if ai_generated is None:
        return _error("error:ValueError")

    if ai_generated < 0.0:
        ai_generated = 0.0
    elif ai_generated > 1.0:
        ai_generated = 1.0

    confidence = max(ai_generated, 1.0 - ai_generated)
    signals = [
        "model:genai",
        f"ai_generated:{ai_generated:.3f}",
    ]

    return {
        "engine": "sightengine",
        "ai_likelihood": ai_generated,
        "confidence": confidence,
        "signals": signals,
        "notes": "ok",
        "available": True,
        "status": "ok",
    }
