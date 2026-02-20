import Backend.ensemble as ensemble


def test_calibration_applies_to_local_models(monkeypatch):
    monkeypatch.setenv("AIREALCHECK_IMAGE_CALIBRATION_ENABLE", "true")
    monkeypatch.setenv("AIREALCHECK_IMAGE_CALIBRATION_TEMPERATURE", "2.0")

    raw_local = {
        "engine": "xception",
        "ai_likelihood": 0.8,
        "confidence": 0.9,
        "signals": [],
        "notes": "ok",
        "available": True,
        "status": "ok",
    }
    norm_local = ensemble._normalize_engine_result(raw_local, "xception")
    assert norm_local.get("ai_likelihood") is not None
    assert norm_local.get("ai_likelihood") < 0.8
    assert "calibration" in (norm_local.get("notes") or "")

    raw_remote = {
        "engine": "hive",
        "ai_likelihood": 0.8,
        "confidence": 0.9,
        "signals": [],
        "notes": "ok",
        "available": True,
        "status": "ok",
    }
    norm_remote = ensemble._normalize_engine_result(raw_remote, "hive")
    assert abs(norm_remote.get("ai_likelihood") - 0.8) < 1e-6


def test_provenance_excluded_from_ai_score(monkeypatch):
    monkeypatch.setenv("AIREALCHECK_IMAGE_CALIBRATION_ENABLE", "false")

    raw_x = {
        "engine": "xception",
        "ai_likelihood": 0.5,
        "confidence": 0.9,
        "signals": [],
        "notes": "ok",
        "available": True,
        "status": "ok",
    }
    raw_c2pa = {
        "engine": "c2pa",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": ["signature_verified"],
        "notes": "ok",
        "available": True,
        "status": "ok",
    }
    raw_watermark = {
        "engine": "watermark",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": ["no_watermark_detected"],
        "notes": "neutral",
        "available": True,
        "status": "ok",
    }

    norm_x = ensemble._normalize_engine_result(raw_x, "xception")
    norm_c2pa = ensemble._normalize_engine_result(raw_c2pa, "c2pa")
    norm_watermark = ensemble._normalize_engine_result(raw_watermark, "watermark")

    score = ensemble.compute_final_score([norm_x, norm_c2pa, norm_watermark], media_type="image")
    assert score is not None
    assert abs(score - 0.5) < 1e-6
