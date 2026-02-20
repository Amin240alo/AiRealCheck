import os
import time

import requests

from Backend.engines.engine_utils import make_engine_result


ENGINE_NAME = "sensity_image"


def _enabled() -> bool:
    return os.getenv("AIREALCHECK_ENABLE_SENSITY_IMAGE", "false").lower() in {"1", "true", "yes", "on"}


def _paid_apis_enabled() -> bool:
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _paid_api_timeouts():
    connect = float(os.getenv("AIREALCHECK_PAID_API_CONNECT_TIMEOUT_SEC", "8"))
    read = float(os.getenv("AIREALCHECK_PAID_API_READ_TIMEOUT_SEC", "25"))
    return connect, read


def _api_key() -> str:
    return (os.getenv("SENSITY_API_KEY") or "").strip()


def _resolve_url():
    explicit = (os.getenv("SENSITY_API_URL") or "").strip()
    if explicit:
        return explicit, "url"
    base_url = (os.getenv("SENSITY_API_BASE_URL") or "").strip()
    endpoint = (os.getenv("SENSITY_API_IMAGE_ENDPOINT") or "").strip()
    if not base_url or not endpoint:
        return "", "missing_endpoint"
    return base_url.rstrip("/") + "/" + endpoint.lstrip("/"), "base_endpoint"


def _clamp01(value):
    try:
        v = float(value)
    except Exception:
        return None
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _normalize_prob(value):
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = v / 100.0 if v <= 100.0 else 1.0
    if v > 1.0:
        v = 1.0
    return v


def _iter_payload(obj, depth=0, max_depth=4):
    if depth > max_depth:
        return
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k, v
            if isinstance(v, (dict, list, tuple)):
                for inner in _iter_payload(v, depth + 1, max_depth):
                    yield inner
    elif isinstance(obj, (list, tuple)):
        for item in obj:
            if isinstance(item, (dict, list, tuple)):
                for inner in _iter_payload(item, depth + 1, max_depth):
                    yield inner


def _find_numeric(payload, keys):
    keys_l = {k.lower() for k in keys}
    for key, value in _iter_payload(payload):
        if str(key).lower() in keys_l:
            try:
                return float(value)
            except Exception:
                continue
    return None


def _find_string(payload, keys):
    keys_l = {k.lower() for k in keys}
    for key, value in _iter_payload(payload):
        if str(key).lower() in keys_l and isinstance(value, str):
            value = value.strip()
            if value:
                return value
    return None


def _extract_score(payload):
    if not isinstance(payload, dict):
        return None, None, "payload_not_dict"

    score_keys = (
        "ai_likelihood",
        "ai_score",
        "fake_score",
        "deepfake_score",
        "score",
        "probability",
        "prob",
        "p_fake",
        "p_ai",
    )
    score_val = _find_numeric(payload, score_keys)
    if score_val is not None:
        ai_prob = _normalize_prob(score_val)
        return ai_prob, None, "score_key"

    fake_val = _find_numeric(payload, ("fake", "ai", "ai_generated", "synthetic"))
    if fake_val is not None:
        ai_prob = _normalize_prob(fake_val)
        return ai_prob, None, "fake_key"

    real_val = _find_numeric(payload, ("real", "authentic", "genuine"))
    if real_val is not None:
        ai_prob = _normalize_prob(1.0 - _normalize_prob(real_val))
        return ai_prob, None, "real_key"

    label = _find_string(payload, ("label", "prediction", "class", "result"))
    conf_val = _find_numeric(payload, ("confidence", "probability", "prob"))
    if label and conf_val is not None:
        label_l = label.lower()
        conf_prob = _normalize_prob(conf_val)
        if conf_prob is None:
            conf_prob = 0.5
        if label_l in {"fake", "ai", "ai_generated", "synthetic", "deepfake", "manipulated"}:
            ai_prob = conf_prob
        else:
            ai_prob = _clamp01(1.0 - conf_prob)
        return ai_prob, conf_prob, f"label:{label_l}"

    return None, None, "score_not_found"


def analyze_sensity_image(file_path: str):
    start = time.time()
    if not _enabled():
        return make_engine_result(
            engine=ENGINE_NAME,
            status="disabled",
            notes="disabled:flag_off",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["disabled"],
            start_time=start,
        )
    if not _paid_apis_enabled():
        return make_engine_result(
            engine=ENGINE_NAME,
            status="disabled",
            notes="disabled:paid_apis_off",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["paid_apis_disabled"],
            start_time=start,
        )
    api_key = _api_key()
    if not api_key:
        return make_engine_result(
            engine=ENGINE_NAME,
            status="disabled",
            notes="disabled:missing_key",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["missing_key"],
            start_time=start,
        )

    url, source = _resolve_url()
    if not url:
        return make_engine_result(
            engine=ENGINE_NAME,
            status="disabled",
            notes=f"disabled:{source}",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[source],
            start_time=start,
        )

    file_field = (os.getenv("SENSITY_API_FILE_FIELD") or "file").strip() or "file"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-API-KEY": api_key,
    }
    try:
        with open(file_path, "rb") as f:
            files = {file_field: f}
            resp = requests.post(url, files=files, headers=headers, timeout=_paid_api_timeouts())
    except Exception as exc:
        return make_engine_result(
            engine=ENGINE_NAME,
            status="error",
            notes=f"request_failed:{type(exc).__name__}",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["request_failed"],
            start_time=start,
        )

    if resp.status_code < 200 or resp.status_code >= 300:
        return make_engine_result(
            engine=ENGINE_NAME,
            status="error",
            notes=f"http_{resp.status_code}",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[f"http_{resp.status_code}"],
            start_time=start,
        )

    try:
        payload = resp.json()
    except Exception:
        return make_engine_result(
            engine=ENGINE_NAME,
            status="error",
            notes="invalid_json",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["invalid_json"],
            start_time=start,
        )

    ai_prob, confidence, parse_note = _extract_score(payload)
    if ai_prob is None:
        return make_engine_result(
            engine=ENGINE_NAME,
            status="error",
            notes=f"parse_failed:{parse_note}",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["parse_failed"],
            start_time=start,
        )

    if confidence is None:
        confidence = max(ai_prob, 1.0 - ai_prob)
    confidence = _clamp01(confidence) or 0.0

    notes = f"ok:endpoint={url}"
    if parse_note:
        notes = f"{notes};{parse_note}"

    signals = [f"endpoint:{url}"]
    if parse_note:
        signals.append(parse_note)
    return make_engine_result(
        engine=ENGINE_NAME,
        status="ok",
        notes=notes,
        available=True,
        ai_likelihood=ai_prob,
        confidence=confidence,
        signals=signals[:6],
        start_time=start,
    )
