import json


def _to_float_or_none(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except Exception:
        return None


def _empty_payload():
    return {
        "default": None,
        "per_media": {"image": None, "video": None, "audio": None},
    }


def load_thresholds(path: str):
    payload = _empty_payload()
    if not path:
        return payload
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except Exception:
        return payload
    if not isinstance(data, dict):
        return payload

    overall = data.get("overall")
    if isinstance(overall, dict):
        recs = overall.get("threshold_recommendations")
        if isinstance(recs, dict):
            fpr_block = recs.get("fpr_limited")
            if isinstance(fpr_block, dict):
                payload["default"] = _to_float_or_none(fpr_block.get("threshold"))

    per_media = data.get("per_media")
    if isinstance(per_media, dict):
        for media in ("image", "video", "audio"):
            media_entry = per_media.get(media)
            if not isinstance(media_entry, dict):
                continue
            recs = media_entry.get("threshold_recommendations")
            if not isinstance(recs, dict):
                continue
            fpr_block = recs.get("fpr_limited")
            if not isinstance(fpr_block, dict):
                continue
            payload["per_media"][media] = _to_float_or_none(fpr_block.get("threshold"))

    return payload
