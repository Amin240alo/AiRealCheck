import os

from Backend.engines.engine_utils import make_engine_result
from Backend.engines.reality_defender_engine import analyze_reality_defender


def _flag_enabled(name, default="false"):
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _creds_present():
    return bool((os.getenv("REALITY_DEFENDER_API_KEY") or "").strip())


def _placeholder(status, notes, signals):
    return make_engine_result(
        engine="reality_defender_audio",
        status=status,
        notes=notes,
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=signals,
        timing_ms=0,
    )


def analyze_reality_defender_audio(asset_path: str) -> dict:
    if not _flag_enabled("AIREALCHECK_ENABLE_REALITY_DEFENDER_AUDIO", "false"):
        return _placeholder("disabled", "disabled:flag_off", ["disabled"])
    if not _paid_apis_enabled():
        return _placeholder("disabled", "disabled:paid_apis_off", ["paid_apis_disabled"])
    if not _creds_present():
        return _placeholder("not_available", "not_available:missing_key", ["missing_key"])
    result = analyze_reality_defender(asset_path)
    if isinstance(result, dict):
        result = dict(result)
        result["engine"] = "reality_defender_audio"
        result.setdefault("optional", True)
    return result
