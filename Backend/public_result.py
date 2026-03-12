import datetime as dt
import json

SCHEMA_VERSION = "public_result_v1"

_ALLOWED_VERDICTS = {"likely_ai", "likely_real", "uncertain"}
_ALLOWED_TRAFFIC = {"red", "yellow", "green"}
_ALLOWED_CONFIDENCE = {"low", "medium", "high"}


def is_public_result(payload) -> bool:
    if not isinstance(payload, dict):
        return False
    meta = payload.get("meta")
    if not isinstance(meta, dict):
        return False
    return meta.get("schema_version") == SCHEMA_VERSION


def _iso(dt_value):
    if not dt_value:
        return None
    if isinstance(dt_value, str):
        return dt_value
    if isinstance(dt_value, dt.datetime):
        if dt_value.tzinfo is None:
            return dt_value.isoformat() + "Z"
        return dt_value.isoformat().replace("+00:00", "Z")
    return str(dt_value)


def _clamp_percent(value):
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if v <= 1.0:
        v *= 100.0
    v = max(0.0, min(100.0, v))
    return int(round(v))


def _clamp01(value):
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _safe_text(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    lowered = text.lower()
    if "traceback" in lowered or "exception" in lowered:
        return None
    return text[:240]


def _normalize_text_list(values):
    items = values if isinstance(values, list) else []
    out = []
    for item in items:
        text = _safe_text(item)
        if text:
            out.append(text)
    return out


def _normalize_confidence_label(value):
    label = str(value or "").strip().lower()
    if label in _ALLOWED_CONFIDENCE:
        return label
    return "low"


def _verdict_from_percent(ai_percent):
    if ai_percent is None:
        return "uncertain"
    if ai_percent <= 20:
        return "likely_real"
    if ai_percent <= 60:
        return "uncertain"
    return "likely_ai"


def _traffic_from_verdict(verdict_key):
    if verdict_key == "likely_real":
        return "green"
    if verdict_key == "likely_ai":
        return "red"
    return "yellow"


def _labels_from_verdict(verdict_key):
    if verdict_key == "likely_real":
        return "Überwiegend echt", "Likely real"
    if verdict_key == "likely_ai":
        return "Überwiegend KI", "Likely AI-generated"
    return "Unsicher", "Uncertain"


def _normalize_engine_entry(entry):
    if not isinstance(entry, dict):
        return None
    engine = (entry.get("engine") or "").strip()
    if not engine:
        return None
    status = entry.get("status")
    status_text = str(status).strip() if status is not None else None
    available_raw = entry.get("available")
    available = bool(available_raw) if isinstance(available_raw, bool) else True
    ai_raw = entry.get("ai_likelihood")
    if ai_raw is None:
        ai_raw = entry.get("ai")
    ai_percent = _clamp_percent(ai_raw)
    ai01 = None
    if ai_percent is not None:
        ai01 = round(ai_percent / 100.0, 4)
    confidence01 = _clamp01(entry.get("confidence"))
    timing_ms = entry.get("timing_ms")
    try:
        timing_ms = int(timing_ms) if timing_ms is not None else 0
    except Exception:
        timing_ms = 0
    notes = _safe_text(entry.get("notes"))
    warning = _safe_text(entry.get("warning"))
    if not available or (status_text and status_text.lower() not in {"ok"}):
        ai_percent = None
        ai01 = None
        confidence01 = None
    item = {
        "engine": engine,
        "status": status_text,
        "available": available,
        "ai01": ai01,
        "ai_percent": ai_percent,
        "confidence01": confidence01,
        "timing_ms": timing_ms,
    }
    if notes:
        item["notes"] = notes
    if warning:
        item["warning"] = warning
    return item


def _normalize_engines(raw_payload):
    raw_list = raw_payload.get("engine_results") if isinstance(raw_payload, dict) else None
    if not isinstance(raw_list, list):
        return []
    engines = []
    for entry in raw_list:
        item = _normalize_engine_entry(entry)
        if item:
            engines.append(item)
    return engines


def _extract_section(engine_list, engine_name, status_key, summary_key):
    entry = next((e for e in engine_list if e.get("engine") == engine_name), None)
    if not entry:
        return None
    section = {}
    status = entry.get("status") or ("not_available" if entry.get("available") is False else "ok")
    if status:
        section[status_key] = status
    summary = entry.get("notes") or entry.get("warning")
    if summary:
        section[summary_key] = summary
    return section or None


def _build_forensics_section(engine_list):
    for name in ("forensics", "video_forensics", "audio_forensics"):
        entry = next((e for e in engine_list if e.get("engine") == name), None)
        if entry:
            section = {"ai_percent": entry.get("ai_percent")}
            summary_lines = []
            if entry.get("available") is False:
                summary_lines.append("Forensik nicht verfügbar.")
            note = entry.get("notes")
            warn = entry.get("warning")
            if note:
                summary_lines.append(note)
            if warn:
                summary_lines.append(warn)
            summary_lines = [line for line in summary_lines if line]
            if summary_lines:
                section["summary_lines"] = summary_lines[:3]
            return section
    return None


def _coerce_raw_payload(raw_payload):
    if raw_payload is None:
        return {}
    if isinstance(raw_payload, dict):
        return raw_payload
    if isinstance(raw_payload, str):
        try:
            parsed = json.loads(raw_payload)
        except Exception:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def build_public_result_v1(raw_payload, analysis_id=None, media_type=None, created_at=None):
    if is_public_result(raw_payload):
        return raw_payload
    raw = _coerce_raw_payload(raw_payload)

    raw_error = bool(raw.get("ok") is False or raw.get("error"))

    meta = {
        "schema_version": SCHEMA_VERSION,
        "analysis_id": raw.get("analysis_id") or analysis_id,
        "media_type": raw.get("media_type") or media_type,
        "created_at": _iso(
            (raw.get("timestamps") or {}).get("created_at") or raw.get("created_at") or created_at
        ),
    }

    ai_percent = _clamp_percent(raw.get("final_ai"))
    if ai_percent is None:
        ai_percent = _clamp_percent(raw.get("ai_likelihood"))
    real_percent = 100 - ai_percent if ai_percent is not None else None

    verdict_key = raw.get("verdict") if raw.get("verdict") in _ALLOWED_VERDICTS else None
    if not verdict_key:
        verdict_key = _verdict_from_percent(ai_percent)
    traffic_light = raw.get("traffic_light") if raw.get("traffic_light") in _ALLOWED_TRAFFIC else None
    if not traffic_light:
        traffic_light = _traffic_from_verdict(verdict_key)
    label_de = _safe_text(raw.get("label_de"))
    label_en = _safe_text(raw.get("label_en"))
    if not label_de or not label_en:
        label_de_fallback, label_en_fallback = _labels_from_verdict(verdict_key)
        label_de = label_de or label_de_fallback
        label_en = label_en or label_en_fallback

    confidence_label = _normalize_confidence_label(raw.get("confidence_label"))
    confidence01 = _clamp01(raw.get("confidence"))
    conflict = raw.get("conflict")
    conflict = bool(conflict) if isinstance(conflict, bool) else False
    reasons_user = _normalize_text_list(raw.get("reasons_user") or raw.get("reasons") or [])
    warnings_user = _normalize_text_list(raw.get("warnings_user") or [])

    if raw_error:
        verdict_key = "uncertain"
        traffic_light = "yellow"
        label_de = "Analyse fehlgeschlagen"
        label_en = "Analysis failed"
        ai_percent = None
        real_percent = None
        confidence_label = "low"
        confidence01 = None
        conflict = False
        if not reasons_user:
            reasons_user = ["Analyse fehlgeschlagen. Bitte erneut versuchen."]
        warnings_user = []

    summary = {
        "verdict_key": verdict_key,
        "label_de": label_de,
        "label_en": label_en,
        "traffic_light": traffic_light,
        "ai_percent": ai_percent,
        "real_percent": real_percent,
        "confidence_label": confidence_label,
        "confidence01": confidence01,
        "conflict": conflict,
        "reasons_user": reasons_user,
        "warnings_user": warnings_user,
    }

    decision_threshold = _clamp01(raw.get("decision_threshold"))
    engines = _normalize_engines(raw)
    details = {
        "decision_threshold": decision_threshold,
        "engines": engines,
    }

    provenance = _extract_section(engines, "c2pa", "c2pa_status", "c2pa_summary")
    if provenance:
        details["provenance"] = provenance

    watermarks = _extract_section(engines, "watermark", "status", "summary")
    if watermarks:
        details["watermarks"] = watermarks

    forensics = _build_forensics_section(engines)
    if forensics:
        details["forensics"] = forensics

    return {
        "meta": meta,
        "summary": summary,
        "details": details,
    }
