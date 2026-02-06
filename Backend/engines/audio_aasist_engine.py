ENGINE_NAME = "audio_aasist"


def run_audio_aasist(file_path):
    return {
        "engine": ENGINE_NAME,
        "status": "ok",
        "available": False,
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": [],
        "notes": "aasist_stub_created",
        "timing_ms": 0,
    }
