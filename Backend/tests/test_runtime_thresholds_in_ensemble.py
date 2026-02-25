import json

from Backend import ensemble


def _engine(ai_value):
    return {
        "engine": "hive",
        "ai_likelihood": ai_value,
        "confidence": 0.9,
        "signals": [],
        "notes": "ok",
        "status": "ok",
        "available": True,
        "timing_ms": 0,
    }


def _write_report(path, default_value=None, image_value=None):
    payload = {
        "overall": {"threshold_recommendations": {"fpr_limited": {"threshold": default_value}}},
        "per_media": {
            "image": {"threshold_recommendations": {"fpr_limited": {"threshold": image_value}}},
            "video": {"threshold_recommendations": {"fpr_limited": {"threshold": None}}},
            "audio": {"threshold_recommendations": {"fpr_limited": {"threshold": None}}},
        },
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_runtime_thresholds_applied(monkeypatch, tmp_path):
    report_path = tmp_path / "report.json"
    _write_report(report_path, default_value=0.4, image_value=0.7)

    monkeypatch.setenv("AIREALCHECK_ENABLE_RUNTIME_THRESHOLDS", "true")
    monkeypatch.setenv("AIREALCHECK_RUNTIME_THRESHOLDS_PATH", str(report_path))
    monkeypatch.delenv("AIREALCHECK_DECISION_THRESHOLD", raising=False)

    result = ensemble.build_standard_result("image", [_engine(0.6)], "test", 0.6)
    assert result["decision_threshold"] == 0.7
    assert result["predicted_label"] == 0


def test_runtime_thresholds_manual_override(monkeypatch, tmp_path):
    report_path = tmp_path / "report.json"
    _write_report(report_path, default_value=0.4, image_value=0.2)

    monkeypatch.setenv("AIREALCHECK_ENABLE_RUNTIME_THRESHOLDS", "true")
    monkeypatch.setenv("AIREALCHECK_RUNTIME_THRESHOLDS_PATH", str(report_path))
    monkeypatch.setenv("AIREALCHECK_DECISION_THRESHOLD", "1.2")

    result = ensemble.build_standard_result("image", [_engine(0.6)], "test", 0.6)
    assert result["decision_threshold"] == 1.0
    assert result["predicted_label"] == 0
