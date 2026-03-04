import datetime as dt
import json

from flask import Blueprint, request, jsonify, g
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError

from Backend.db import get_session
from Backend.models import AnalysisHistory
from Backend.middleware import require_verified_email, _error

bp_history = Blueprint("history", __name__, url_prefix="/api/history")


def _iso(dt_value):
    if not dt_value:
        return None
    if getattr(dt_value, "tzinfo", None) is None:
        return dt_value.isoformat() + "Z"
    return dt_value.isoformat().replace("+00:00", "Z")


def _safe_json_load(raw):
    if raw is None:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return None


def _parse_int(value, default):
    try:
        return int(value)
    except Exception:
        return default


def _normalize_percent(value, decimals=0):
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if v <= 1.0:
        v *= 100.0
    v = max(0.0, min(100.0, v))
    if decimals <= 0:
        return int(round(v))
    return round(v, decimals)


def _extract_final_score(payload):
    if not isinstance(payload, dict):
        return None
    raw = payload.get("ai_likelihood")
    if raw is None:
        raw = payload.get("final_ai")
    return _normalize_percent(raw, decimals=0)


def _extract_verdict_label(payload):
    if not isinstance(payload, dict):
        return None
    label = payload.get("label_de") or payload.get("verdict_label")
    if isinstance(label, str) and label.strip():
        return label.strip()
    verdict = (payload.get("verdict") or "").strip().lower()
    if verdict == "likely_ai":
        return "Wahrscheinlich KI"
    if verdict == "likely_real":
        return "Wahrscheinlich echt"
    if verdict == "uncertain":
        return "Unsicher"
    return None


def _extract_engine_breakdown(payload):
    if not isinstance(payload, dict):
        return None
    raw = payload.get("engine_results")
    if not isinstance(raw, list):
        return None
    breakdown = {}
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        engine = (entry.get("engine") or "").strip()
        if not engine:
            continue
        score_value = entry.get("ai_likelihood")
        if score_value is None:
            score_value = entry.get("ai")
        score = _normalize_percent(score_value, decimals=0)
        confidence = _normalize_percent(entry.get("confidence"), decimals=1)
        item = {
            "score": score,
            "confidence": confidence,
        }
        status = entry.get("status")
        if status:
            item["status"] = status
        available = entry.get("available")
        if isinstance(available, bool):
            item["available"] = available
        breakdown[engine] = item
    return breakdown or None


def _extract_result_payload(payload):
    if not isinstance(payload, dict):
        return None
    keys = [
        "verdict",
        "traffic_light",
        "label_de",
        "label_en",
        "confidence",
        "confidence_label",
        "reasons",
        "reasons_user",
        "warnings_user",
        "ensemble_signals",
        "final_ai",
        "final_real",
        "ai_likelihood",
        "real_likelihood",
        "primary_source",
        "timestamps",
        "conflict",
    ]
    out = {}
    for key in keys:
        if key in payload:
            out[key] = payload.get(key)
    return out or None


def record_history_entry(
    *,
    user_id: int,
    history_id: str,
    media_type: str,
    title: str,
    status: str,
    payload: dict,
    credits_charged: int,
    created_at=None,
    file_ref=None,
    thumb_ref=None,
    logger=None,
):
    if not user_id or not history_id:
        return False
    history_id = str(history_id)
    title_value = (title or "").strip()
    if len(title_value) > 255:
        title_value = title_value[:252] + "..."
    final_score = _extract_final_score(payload)
    verdict_label = _extract_verdict_label(payload)
    engine_breakdown = _extract_engine_breakdown(payload)
    result_payload = _extract_result_payload(payload)
    created_at_value = created_at if created_at is not None else dt.datetime.utcnow()

    db = get_session()
    try:
        existing = db.query(AnalysisHistory).get(history_id)
        if existing:
            if logger:
                logger.info("HISTORY_SAVE_OK history_id=%s user_id=%s existing=true", history_id, user_id)
            return True
        row = AnalysisHistory(
            id=history_id,
            user_id=int(user_id),
            media_type=(media_type or None),
            file_ref=file_ref,
            thumb_ref=thumb_ref,
            title=title_value or None,
            status=(status or "success"),
            final_score=final_score,
            verdict_label=verdict_label,
            engine_breakdown=(
                json.dumps(engine_breakdown, ensure_ascii=False)
                if engine_breakdown is not None
                else None
            ),
            result_payload=(
                json.dumps(result_payload, ensure_ascii=False)
                if result_payload is not None
                else None
            ),
            credits_charged=int(credits_charged or 0),
            created_at=created_at_value,
            updated_at=None,
        )
        db.add(row)
        db.commit()
        if logger:
            logger.info("HISTORY_SAVE_OK history_id=%s user_id=%s", history_id, user_id)
        return True
    except IntegrityError:
        db.rollback()
        if logger:
            logger.info("HISTORY_SAVE_OK history_id=%s user_id=%s existing=true", history_id, user_id)
        return True
    except Exception as exc:
        db.rollback()
        if logger:
            logger.warning(
                "HISTORY_SAVE_FAILED history_id=%s user_id=%s error=%s",
                history_id,
                user_id,
                type(exc).__name__,
            )
        return False
    finally:
        db.close()


@bp_history.get("")
@require_verified_email
def list_history():
    limit = _parse_int(request.args.get("limit"), 20)
    offset = _parse_int(request.args.get("offset"), 0)
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    media_type = (request.args.get("media_type") or "").strip().lower()
    db = get_session()
    try:
        query = db.query(AnalysisHistory).filter(AnalysisHistory.user_id == int(g.current_user_id))
        if media_type:
            query = query.filter(AnalysisHistory.media_type == media_type)
        rows = (
            query.order_by(desc(AnalysisHistory.created_at))
            .limit(limit)
            .offset(offset)
            .all()
        )
        items = []
        for row in rows:
            score = None
            if isinstance(row.final_score, (int, float)):
                score = int(round(float(row.final_score)))
            items.append(
                {
                    "id": row.id,
                    "created_at": _iso(row.created_at),
                    "media_type": row.media_type,
                    "title": row.title,
                    "status": row.status,
                    "final_score": score,
                    "verdict_label": row.verdict_label,
                    "credits_charged": int(row.credits_charged or 0),
                }
            )
        return jsonify(items)
    finally:
        db.close()


@bp_history.get("/<history_id>")
@require_verified_email
def get_history(history_id: str):
    db = get_session()
    try:
        row = db.query(AnalysisHistory).get(str(history_id))
        if not row:
            return _error("not_found", 404)
        if row.user_id != int(g.current_user_id):
            return _error("forbidden", 403)
        engine_breakdown = _safe_json_load(row.engine_breakdown) or {}
        result_payload = _safe_json_load(row.result_payload) or {}
        score = None
        if isinstance(row.final_score, (int, float)):
            score = int(round(float(row.final_score)))
        payload = {
            "id": row.id,
            "created_at": _iso(row.created_at),
            "media_type": row.media_type,
            "title": row.title,
            "status": row.status,
            "final_score": score,
            "verdict_label": row.verdict_label,
            "credits_charged": int(row.credits_charged or 0),
            "engine_breakdown": engine_breakdown,
            "result_payload": result_payload or None,
            "file_ref": row.file_ref,
            "thumb_ref": row.thumb_ref,
        }
        return jsonify(payload)
    finally:
        db.close()
