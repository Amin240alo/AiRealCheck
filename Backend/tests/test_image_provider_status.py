import Backend.engines.hive_engine as hive_engine
import Backend.engines.reality_defender_engine as reality_defender_engine
import Backend.engines.sensity_image_engine as sensity_image_engine
import Backend.engines.sightengine_engine as sightengine_engine


def _make_tmp_image(tmp_path):
    img_path = tmp_path / "tmp.jpg"
    img_path.write_bytes(b"test")
    return str(img_path)


def test_image_providers_missing_keys_disabled(monkeypatch, tmp_path):
    monkeypatch.setenv("AIREALCHECK_USE_PAID_APIS", "true")
    img_path = _make_tmp_image(tmp_path)

    monkeypatch.delenv("HIVE_API_KEY", raising=False)
    monkeypatch.delenv("HIVE_API_KEY_ID", raising=False)
    monkeypatch.delenv("HIVE_API_SECRET", raising=False)
    hive_res = hive_engine.run_hive(img_path)
    assert hive_res.get("status") == "disabled"
    assert hive_res.get("available") is False

    monkeypatch.delenv("SIGHTENGINE_API_KEY", raising=False)
    monkeypatch.delenv("SIGHTENGINE_API_USER", raising=False)
    monkeypatch.delenv("SIGHTENGINE_API_SECRET", raising=False)
    se_res = sightengine_engine.run_sightengine(img_path)
    assert se_res.get("status") == "disabled"
    assert se_res.get("available") is False

    monkeypatch.delenv("REALITY_DEFENDER_API_KEY", raising=False)
    rd_res = reality_defender_engine.analyze_reality_defender(img_path)
    assert rd_res.get("status") == "disabled"
    assert rd_res.get("available") is False

    monkeypatch.setenv("AIREALCHECK_ENABLE_SENSITY_IMAGE", "true")
    monkeypatch.delenv("SENSITY_API_KEY", raising=False)
    sensity_res = sensity_image_engine.analyze_sensity_image(img_path)
    assert sensity_res.get("status") == "disabled"
    assert sensity_res.get("available") is False
