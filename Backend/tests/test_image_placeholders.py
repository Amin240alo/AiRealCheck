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


def _find_engine(results, name):
    for item in results:
        if isinstance(item, dict) and item.get("engine") == name:
            return item
    return None


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


def test_image_placeholders_disabled_when_flags_off(monkeypatch, tmp_path):
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

    hive = _find_engine(engine_results_raw, "hive")
    sightengine = _find_engine(engine_results_raw, "sightengine")
    reality_defender = _find_engine(engine_results_raw, "reality_defender")
    sensity = _find_engine(engine_results_raw, "sensity_image")

    assert hive is not None and hive.get("status") == "disabled" and hive.get("available") is False
    assert sightengine is not None and sightengine.get("status") == "disabled" and sightengine.get("available") is False
    assert (
        reality_defender is not None
        and reality_defender.get("status") == "disabled"
        and reality_defender.get("available") is False
    )
    assert sensity is not None and sensity.get("status") == "disabled" and sensity.get("available") is False
