import os
import time

from Backend.engines.engine_utils import make_engine_result


ENGINE_NAME = "sensity_image"


def _enabled() -> bool:
    return os.getenv("AIREALCHECK_ENABLE_SENSITY_IMAGE", "false").lower() in {"1", "true", "yes", "on"}


def _api_key() -> str:
    return (os.getenv("SENSITY_API_KEY") or "").strip()


def analyze_sensity_image(file_path: str):
    start = time.time()
    if not _enabled():
        return make_engine_result(
            engine=ENGINE_NAME,
            status="disabled",
            notes="disabled:flag_off",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["disabled"],
            start_time=start,
        )
    if not _api_key():
        return make_engine_result(
            engine=ENGINE_NAME,
            status="not_available",
            notes="not_available:missing_key",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["missing_key"],
            start_time=start,
        )
    return make_engine_result(
        engine=ENGINE_NAME,
        status="not_implemented",
        notes="not_implemented",
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=["not_implemented"],
        start_time=start,
    )
