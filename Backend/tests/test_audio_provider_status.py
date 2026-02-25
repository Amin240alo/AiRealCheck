import Backend.engines.reality_defender_audio_engine as rd_audio_engine


def _make_tmp_audio(tmp_path):
    audio_path = tmp_path / "tmp.wav"
    audio_path.write_bytes(b"test")
    return str(audio_path)


def test_reality_defender_audio_flag_off_disabled(monkeypatch, tmp_path):
    monkeypatch.setenv("AIREALCHECK_ENABLE_REALITY_DEFENDER_AUDIO", "false")
    monkeypatch.setenv("AIREALCHECK_USE_PAID_APIS", "true")
    monkeypatch.setenv("REALITY_DEFENDER_API_KEY", "dummy")
    audio_path = _make_tmp_audio(tmp_path)

    result = rd_audio_engine.analyze_reality_defender_audio(audio_path)
    assert result.get("status") == "disabled"
    assert result.get("available") is False


def test_reality_defender_audio_missing_key_not_available(monkeypatch, tmp_path):
    monkeypatch.setenv("AIREALCHECK_ENABLE_REALITY_DEFENDER_AUDIO", "true")
    monkeypatch.setenv("AIREALCHECK_USE_PAID_APIS", "true")
    monkeypatch.delenv("REALITY_DEFENDER_API_KEY", raising=False)
    audio_path = _make_tmp_audio(tmp_path)

    result = rd_audio_engine.analyze_reality_defender_audio(audio_path)
    assert result.get("status") == "not_available"
    assert result.get("available") is False
