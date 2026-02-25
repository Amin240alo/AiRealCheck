import json

from Backend.runtime_thresholds import load_thresholds


def test_load_thresholds_extracts_values(tmp_path):
    payload = {
        "overall": {"threshold_recommendations": {"fpr_limited": {"threshold": 0.33}}},
        "per_media": {
            "image": {"threshold_recommendations": {"fpr_limited": {"threshold": 0.42}}},
            "video": {"threshold_recommendations": {"fpr_limited": {"threshold": "0.55"}}},
            "audio": {"threshold_recommendations": {"fpr_limited": {"threshold": None}}},
        },
    }
    path = tmp_path / "report.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    thresholds = load_thresholds(str(path))
    assert thresholds["default"] == 0.33
    assert thresholds["per_media"]["image"] == 0.42
    assert thresholds["per_media"]["video"] == 0.55
    assert thresholds["per_media"]["audio"] is None


def test_load_thresholds_missing_keys_safe(tmp_path):
    path = tmp_path / "report.json"
    path.write_text("{}", encoding="utf-8")

    thresholds = load_thresholds(str(path))
    assert thresholds["default"] is None
    assert thresholds["per_media"]["image"] is None
    assert thresholds["per_media"]["video"] is None
    assert thresholds["per_media"]["audio"] is None

    missing = load_thresholds(str(tmp_path / "missing.json"))
    assert missing["default"] is None
    assert missing["per_media"]["image"] is None
