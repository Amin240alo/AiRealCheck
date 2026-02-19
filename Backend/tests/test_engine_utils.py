from Backend.engines.engine_utils import coerce_engine_result, safe_engine_call


def test_coerce_engine_result_defaults():
    result = coerce_engine_result({}, "demo_engine")
    assert result["engine"] == "demo_engine"
    assert result["status"] == "error"
    assert result["notes"] == "not_available"
    assert result["available"] is False


def test_coerce_engine_result_available_true():
    result = coerce_engine_result({"available": True}, "demo_engine")
    assert result["engine"] == "demo_engine"
    assert result["status"] == "ok"
    assert result["notes"] == "ok"
    assert result["available"] is True


def test_safe_engine_call_exception():
    def _boom():
        raise RuntimeError("boom")

    result = safe_engine_call("boom_engine", _boom)
    assert result["engine"] == "boom_engine"
    assert result["status"] == "error"
    assert result["available"] is False
    assert str(result.get("notes", "")).startswith("exception:RuntimeError")
