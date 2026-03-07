import json
import os

from flask import Blueprint, request, jsonify, g
from sqlalchemy import desc

from Backend.db import get_session
from Backend.models import Analysis
from Backend.middleware import require_verified_email, _error


bp_analyses = Blueprint("analyses", __name__, url_prefix="/analyses")


def _safe_json(raw):
    if raw is None:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return None


@bp_analyses.get("")
@require_verified_email
def list_analyses():
    from flask import g

    limit = min(int(request.args.get("limit", 50) or 50), 200)
    db = get_session()
    try:
        rows = (
            db.query(Analysis)
            .filter(Analysis.user_id == int(g.current_user_id))
            .order_by(desc(Analysis.created_at))
            .limit(limit)
            .all()
        )
        items = [
            {
                "id": row.id,
                "status": row.status,
                "media_type": row.media_type,
                "final_score_ai01": row.final_score_ai01,
                "cost_credits": row.cost_credits,
                "created_at": (row.created_at.isoformat() + "Z") if row.created_at else None,
                "finished_at": (row.finished_at.isoformat() + "Z") if row.finished_at else None,
            }
            for row in rows
        ]
        return jsonify({"ok": True, "items": items})
    finally:
        db.close()


@bp_analyses.get("/<analysis_id>")
@require_verified_email
def get_analysis(analysis_id: str):
    from flask import g

    db = get_session()
    try:
        row = db.query(Analysis).get(str(analysis_id))
        if not row:
            return _error("not_found", 404)
        if row.user_id != int(g.current_user_id) and not bool(getattr(g, "current_user_is_admin", False)):
            return _error("forbidden", 403)
        payload = {
            "id": row.id,
            "status": row.status,
            "media_type": row.media_type,
            "final_score_ai01": row.final_score_ai01,
            "cost_credits": row.cost_credits,
            "result_json": row.result_json,
            "created_at": (row.created_at.isoformat() + "Z") if row.created_at else None,
            "finished_at": (row.finished_at.isoformat() + "Z") if row.finished_at else None,
        }
        debug_raw = os.getenv("AIREALCHECK_DEBUG_RAW", "false").lower() in {"1", "true", "yes"}
        if debug_raw and bool(getattr(g, "current_user_is_admin", False)):
            payload["raw_result_json"] = _safe_json(row.raw_result_json)
        return jsonify({"ok": True, "analysis": payload})
    finally:
        db.close()
