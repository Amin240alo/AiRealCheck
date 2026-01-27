import time

from Backend.image_forensics import analyze_image


def run_forensics(file_path: str):
    start = time.time()
    result = analyze_image(file_path)
    ok = bool(result) and not result.get("error") and result.get("real") is not None and result.get("fake") is not None
    return {
        "ok": bool(ok),
        "engine": "forensics",
        "real": result.get("real"),
        "fake": result.get("fake"),
        "confidence": result.get("confidence"),
        "message": result.get("message"),
        "details": result.get("details", []),
        "warnings": [],
        "timing_ms": int((time.time() - start) * 1000),
    }
