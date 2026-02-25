from Backend.engines.video_frame_detectors_engine import run_video_frame_detectors


def _find_engine(extra_results, name):
    for item in extra_results:
        if isinstance(item, dict) and item.get("engine") == name:
            return item
    return None


def test_placeholders_disabled_when_provider_disabled(monkeypatch, tmp_path):
    monkeypatch.setenv("AIREALCHECK_USE_PAID_APIS", "true")
    monkeypatch.setenv("AIREALCHECK_ENABLE_REALITY_DEFENDER_VIDEO", "false")
    monkeypatch.setenv("AIREALCHECK_ENABLE_HIVE_VIDEO", "false")
    monkeypatch.setenv("AIREALCHECK_ENABLE_SIGHTENGINE_VIDEO", "false")
    monkeypatch.setenv("AIREALCHECK_ENABLE_SENSITY_VIDEO", "false")

    result = run_video_frame_detectors(str(tmp_path / "missing.mp4"))
    extra = result.get("extra_engine_results") or []

    rd = _find_engine(extra, "reality_defender_video")
    hive = _find_engine(extra, "hive_video")
    sensity = _find_engine(extra, "sensity_video")
    sightengine = _find_engine(extra, "sightengine_video")

    assert rd is not None and rd.get("status") == "disabled"
    assert hive is not None and hive.get("status") == "disabled"
    assert sensity is not None and sensity.get("status") == "disabled"
    assert sightengine is not None and sightengine.get("status") == "disabled"


def test_placeholders_not_available_when_key_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("AIREALCHECK_USE_PAID_APIS", "true")
    monkeypatch.setenv("AIREALCHECK_ENABLE_REALITY_DEFENDER_VIDEO", "true")
    monkeypatch.setenv("AIREALCHECK_ENABLE_HIVE_VIDEO", "true")
    monkeypatch.setenv("AIREALCHECK_ENABLE_SIGHTENGINE_VIDEO", "true")
    monkeypatch.setenv("AIREALCHECK_ENABLE_SENSITY_VIDEO", "true")

    monkeypatch.delenv("REALITY_DEFENDER_API_KEY", raising=False)
    monkeypatch.delenv("HIVE_API_KEY", raising=False)
    monkeypatch.delenv("HIVE_API_KEY_ID", raising=False)
    monkeypatch.delenv("HIVE_API_SECRET", raising=False)
    monkeypatch.delenv("SENSITY_API_KEY", raising=False)
    monkeypatch.delenv("SIGHTENGINE_API_KEY", raising=False)
    monkeypatch.delenv("SIGHTENGINE_API_USER", raising=False)
    monkeypatch.delenv("SIGHTENGINE_API_SECRET", raising=False)

    result = run_video_frame_detectors(str(tmp_path / "missing.mp4"))
    extra = result.get("extra_engine_results") or []

    rd = _find_engine(extra, "reality_defender_video")
    hive = _find_engine(extra, "hive_video")
    sensity = _find_engine(extra, "sensity_video")
    sightengine = _find_engine(extra, "sightengine_video")

    assert rd is not None and rd.get("status") == "not_available"
    assert hive is not None and hive.get("status") == "not_available"
    assert sensity is not None and sensity.get("status") == "not_available"
    assert sightengine is not None and sightengine.get("status") == "not_available"


def test_placeholders_present_when_no_engines_run(monkeypatch, tmp_path):
    monkeypatch.setenv("AIREALCHECK_USE_PAID_APIS", "false")
    monkeypatch.setenv("AIREALCHECK_ENABLE_REALITY_DEFENDER_VIDEO", "true")
    monkeypatch.setenv("AIREALCHECK_ENABLE_HIVE_VIDEO", "true")
    monkeypatch.setenv("AIREALCHECK_ENABLE_SIGHTENGINE_VIDEO", "true")
    monkeypatch.setenv("AIREALCHECK_ENABLE_SENSITY_VIDEO", "true")

    path = tmp_path / "empty.mp4"
    path.write_bytes(b"0")

    result = run_video_frame_detectors(str(path))
    extra = result.get("extra_engine_results") or []
    engines = {item.get("engine") for item in extra if isinstance(item, dict)}

    assert "reality_defender_video" in engines
    assert "hive_video" in engines
    assert "sensity_video" in engines
    assert "sightengine_video" in engines
