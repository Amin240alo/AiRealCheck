from Backend import ensemble


def _dummy_engine_result(engine_name):
    return {
        "engine": engine_name,
        "status": "ok",
        "notes": "ok",
        "available": True,
        "ai_likelihood": 0.7,
        "confidence": 0.7,
        "signals": [],
    }


def test_video_whole_video_group_non_empty():
    group = ensemble.VIDEO_ENGINE_GROUPS.get("whole_video_apis")
    assert group, "whole_video_apis must not be empty"


def test_whole_video_engine_in_video_results():
    group = ensemble.VIDEO_ENGINE_GROUPS.get("whole_video_apis")
    engine_name = next(iter(group))
    result = ensemble.build_standard_result(
        media_type="video",
        engine_results_raw=[_dummy_engine_result(engine_name)],
        analysis_id="test",
        ai_likelihood=0.7,
    )
    engines = {e.get("engine") for e in (result.get("engine_results") or [])}
    assert engine_name in engines
