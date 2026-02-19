from Backend.engines.engine_utils import make_engine_result
import Backend.ensemble as ensemble


def _patch_symbol(monkeypatch, name, value, fallback_module=None):
    if hasattr(ensemble, name):
        monkeypatch.setattr(ensemble, name, value)
        return
    if fallback_module:
        module = __import__(fallback_module, fromlist=[name])
        if hasattr(module, name):
            monkeypatch.setattr(module, name, value)
            return
    raise AssertionError(f"patch target missing: {name}")


def _stub_forensics(_path):
    return {
        "ok": True,
        "engine": "forensics",
        "real": 50.0,
        "fake": 50.0,
        "confidence": "low",
        "available": True,
        "status": "ok",
        "notes": "ok",
        "ai_likelihood": 0.5,
        "signals": [],
    }


def _stub_engine(engine_name):
    return make_engine_result(
        engine=engine_name,
        status="disabled",
        notes="stub",
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=["stub"],
        timing_ms=0,
    )


def test_image_engine_results_schema(monkeypatch, tmp_path):
    monkeypatch.setenv("AIREALCHECK_ENABLE_HIVE_IMAGE", "false")
    monkeypatch.setenv("AIREALCHECK_ENABLE_SIGHTENGINE_IMAGE", "false")
    monkeypatch.setenv("AIREALCHECK_ENABLE_REALITY_DEFENDER_IMAGE", "false")
    monkeypatch.setenv("AIREALCHECK_ENABLE_SENSITY_IMAGE", "false")
    monkeypatch.setenv("AIREALCHECK_IMAGE_FALLBACK", "true")

    _patch_symbol(monkeypatch, "run_forensics", _stub_forensics, "Backend.engines.forensics_engine")
    _patch_symbol(monkeypatch, "run_hive", lambda path: _stub_engine("hive"), "Backend.engines.hive_engine")
    _patch_symbol(
        monkeypatch,
        "run_sightengine",
        lambda path: _stub_engine("sightengine"),
        "Backend.engines.sightengine_engine",
    )
    _patch_symbol(
        monkeypatch,
        "analyze_reality_defender",
        lambda path: _stub_engine("reality_defender"),
        "Backend.engines.reality_defender_engine",
    )
    _patch_symbol(
        monkeypatch,
        "analyze_sensity_image",
        lambda path: _stub_engine("sensity_image"),
        "Backend.engines.sensity_image_engine",
    )
    _patch_symbol(monkeypatch, "run_xception", lambda path: _stub_engine("xception"), "Backend.engines.xception_engine")
    _patch_symbol(
        monkeypatch,
        "run_clip_detector",
        lambda path: _stub_engine("clip_detector"),
        "Backend.engines.clip_detector_engine",
    )
    _patch_symbol(monkeypatch, "analyze_c2pa", lambda path: _stub_engine("c2pa"), "Backend.engines.c2pa_engine")
    _patch_symbol(
        monkeypatch,
        "analyze_watermark",
        lambda path: _stub_engine("watermark"),
        "Backend.engines.watermark_engine",
    )

    image_path = tmp_path / "image.jpg"
    image_path.write_bytes(b"test")

    result = ensemble.run_ensemble(str(image_path))
    engine_results_raw = result.get("engine_results_raw") or []

    payload = ensemble.build_standard_result(
        media_type="image",
        engine_results_raw=engine_results_raw,
        analysis_id="test-image-schema",
        ai_likelihood=None,
        reasons=None,
        created_at="2020-01-01T00:00:00Z",
    )
    engine_results = payload.get("engine_results") or []

    assert engine_results
    for entry in engine_results:
        assert "engine" in entry
        assert "status" in entry
        assert "notes" in entry
        assert "available" in entry
        assert "ai_likelihood" in entry
        assert "ok" not in entry
        assert "real" not in entry
        assert "fake" not in entry
        if "timing_ms" in entry:
            assert isinstance(entry.get("timing_ms"), (int, float))
