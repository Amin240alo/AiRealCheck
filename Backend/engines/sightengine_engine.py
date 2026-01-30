import os
import time

import requests


_API_URL = "https://api.sightengine.com/1.0/check.json"


def _parse_api_credentials():
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

    api_user = (os.getenv("SIGHTENGINE_API_USER") or "").strip()
    api_secret = (os.getenv("SIGHTENGINE_API_SECRET") or "").strip()
    return api_user, api_secret


def _not_available():
    return {
        "engine": "sightengine",
        "ai_likelihood": 0.0,
        "confidence": 0.0,
        "signals": [],
        "notes": "not_available",
        "available": False,
    }


def run_sightengine(file_path: str):
    start = time.time()
    api_user, api_secret = _parse_api_credentials()
    if not api_user or not api_secret:
        return _not_available()

    try:
        with open(file_path, "rb") as f:
            files = {"media": f}
            data = {
                "models": "genai",
                "api_user": api_user,
                "api_secret": api_secret,
            }
            resp = requests.post(_API_URL, files=files, data=data, timeout=(5, 20))
    except Exception:
        return _not_available()

    if resp.status_code != 200:
        return _not_available()

    try:
        payload = resp.json()
    except Exception:
        return _not_available()

    if payload.get("status") != "success":
        return _not_available()

    ai_generated = None
    type_block = payload.get("type") if isinstance(payload.get("type"), dict) else {}
    if "ai_generated" in type_block:
        try:
            ai_generated = float(type_block.get("ai_generated"))
        except Exception:
            ai_generated = None

    if ai_generated is None:
        return _not_available()

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
    }
