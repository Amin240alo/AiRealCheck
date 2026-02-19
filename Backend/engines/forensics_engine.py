import os
import time

from Backend.image_forensics import analyze_image
from Backend.engines.engine_utils import make_engine_result


def run_forensics(file_path: str):
    start = time.time()
    if not file_path or not os.path.exists(file_path):
        return make_engine_result(
            engine="forensics",
            status="not_available",
            notes="file_missing",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["file_missing"],
            start_time=start,
        )
    try:
        result = analyze_image(file_path)
    except Exception as exc:
        return make_engine_result(
            engine="forensics",
            status="error",
            notes=f"exception:{type(exc).__name__}",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["exception"],
            start_time=start,
        )
    if not isinstance(result, dict):
        return make_engine_result(
            engine="forensics",
            status="error",
            notes="invalid_result",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["invalid_result"],
            start_time=start,
        )
    if result.get("error") or result.get("real") is None or result.get("fake") is None:
        return make_engine_result(
            engine="forensics",
            status="error",
            notes="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["error"],
            start_time=start,
        )

    fake_val = result.get("fake")
    real_val = result.get("real")
    try:
        fake_float = float(fake_val)
    except Exception:
        fake_float = None
    try:
        real_float = float(real_val)
    except Exception:
        real_float = None

    confidence = 0.0
    if fake_float is not None and real_float is not None:
        top = max(fake_float, real_float)
        if top > 1.0:
            top = top / 100.0 if top <= 100.0 else 1.0
        confidence = max(0.0, min(1.0, top))

    signals = []
    details = result.get("details")
    if isinstance(details, list):
        signals.extend([str(d) for d in details if d is not None])
    elif details:
        signals.append(str(details))
    message = result.get("message")
    if isinstance(message, str) and message.strip():
        signals.append(message.strip())

    return make_engine_result(
        engine="forensics",
        status="ok",
        notes="ok",
        available=True,
        ai_likelihood=fake_float,
        confidence=confidence,
        signals=signals[:6],
        start_time=start,
    )
