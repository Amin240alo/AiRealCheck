import Backend.ensemble as ensemble


def _video_engine(ai_value):
    return {
        "engine": "video_frame_detectors",
        "status": "ok",
        "notes": "ok",
        "available": True,
        "ai_likelihood": ai_value,
        "confidence": 0.6,
        "signals": [],
    }


def _audio_engine(ai_value):
    return {
        "engine": "reality_defender_audio",
        "status": "ok",
        "notes": "ok",
        "available": True,
        "ai_likelihood": ai_value,
        "confidence": 0.7,
        "signals": [],
    }


def test_audio_video_fusion_off_keeps_video_ai(monkeypatch):
    monkeypatch.setenv("AIREALCHECK_ENABLE_AUDIO_VIDEO_FUSION", "false")
    monkeypatch.setenv("AIREALCHECK_AUDIO_VIDEO_FUSION_WEIGHT", "0.2")

    result = ensemble.build_standard_result(
        media_type="video",
        engine_results_raw=[_video_engine(0.2), _audio_engine(0.8)],
        analysis_id="test",
        ai_likelihood=None,
    )
    assert result.get("ai_likelihood") == 20
    assert "audio_video_fusion" not in (result.get("ensemble_signals") or [])


def test_audio_video_fusion_on_changes_video_ai(monkeypatch):
    monkeypatch.setenv("AIREALCHECK_ENABLE_AUDIO_VIDEO_FUSION", "true")
    monkeypatch.setenv("AIREALCHECK_AUDIO_VIDEO_FUSION_WEIGHT", "0.2")

    result = ensemble.build_standard_result(
        media_type="video",
        engine_results_raw=[_video_engine(0.2), _audio_engine(0.8)],
        analysis_id="test",
        ai_likelihood=None,
    )
    assert result.get("ai_likelihood") == 32
    assert "audio_video_fusion" in (result.get("ensemble_signals") or [])
