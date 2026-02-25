import json

from Backend import ensemble


def _reset_weight_caches():
    ensemble._VIDEO_WEIGHTS_CACHE["raw"] = None
    ensemble._VIDEO_WEIGHTS_CACHE["weights"] = None
    ensemble._IMAGE_WEIGHTS_CACHE["raw"] = None
    ensemble._IMAGE_WEIGHTS_CACHE["weights"] = None
    ensemble._LEARNED_WEIGHTS_CACHE["path"] = None
    ensemble._LEARNED_WEIGHTS_CACHE["data"] = None


def test_learned_weights_enabled_loads(tmp_path, monkeypatch):
    weights_path = tmp_path / "weights.json"
    weights_path.write_text(
        json.dumps(
            {
                "video": {
                    "video_frame_detectors": 0.7,
                    "video_temporal": 0.3,
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("AIREALCHECK_ENABLE_LEARNED_WEIGHTS", "true")
    monkeypatch.setenv("AIREALCHECK_LEARNED_WEIGHTS_PATH", str(weights_path))
    monkeypatch.delenv("AIREALCHECK_VIDEO_ENGINE_WEIGHTS_JSON", raising=False)
    _reset_weight_caches()

    weights = ensemble._get_engine_weights("video")
    assert abs(weights.get("video_frame_detectors") - 0.7) < 1e-9
    assert abs(weights.get("video_temporal") - 0.3) < 1e-9


def test_learned_weights_disabled_fallback(monkeypatch):
    monkeypatch.setenv("AIREALCHECK_ENABLE_LEARNED_WEIGHTS", "false")
    _reset_weight_caches()
    weights = ensemble._get_engine_weights("audio")
    assert weights == ensemble.ENGINE_WEIGHTS.get("audio")


def test_learned_weights_missing_file_fallback(tmp_path, monkeypatch):
    missing_path = tmp_path / "missing.json"
    monkeypatch.setenv("AIREALCHECK_ENABLE_LEARNED_WEIGHTS", "true")
    monkeypatch.setenv("AIREALCHECK_LEARNED_WEIGHTS_PATH", str(missing_path))
    _reset_weight_caches()
    weights = ensemble._get_engine_weights("image")
    assert weights == ensemble.ENGINE_WEIGHTS.get("image")


def test_manual_override_has_precedence(tmp_path, monkeypatch):
    weights_path = tmp_path / "weights.json"
    weights_path.write_text(
        json.dumps({"video": {"video_frame_detectors": 0.1, "video_temporal": 0.9}}),
        encoding="utf-8",
    )
    monkeypatch.setenv("AIREALCHECK_ENABLE_LEARNED_WEIGHTS", "true")
    monkeypatch.setenv("AIREALCHECK_LEARNED_WEIGHTS_PATH", str(weights_path))
    monkeypatch.setenv("AIREALCHECK_VIDEO_ENGINE_WEIGHTS_JSON", "{\"video_frame_detectors\": 0.9}")
    _reset_weight_caches()
    weights = ensemble._get_engine_weights("video")
    assert abs(weights.get("video_frame_detectors") - 0.9) < 1e-9
