import os
import datetime as dt
from flask import Blueprint, request, jsonify, current_app

from Backend.db import get_session
from Backend.models import User, CreditTx
from Backend.middleware import jwt_required, ensure_daily_reset, _error


bp_credits = Blueprint("credits", __name__, url_prefix="/credits")

FREE_CREDITS = int(os.getenv("AIREALCHECK_FREE_CREDITS", "100") or 100)
ALLOW_ADMIN = (os.getenv("AIREALCHECK_ALLOW_ADMIN", "false").lower() in {"1", "true", "yes"})
ADMIN_SECRET = os.getenv("AIREALCHECK_ADMIN_SECRET", "")


def _reset_if_needed(u: User, db):
    changed = ensure_daily_reset(u, db)
    if changed:
        db.commit()


@bp_credits.get("/balance")
@jwt_required
def balance():
    from flask import g
    db = get_session()
    try:
        u = db.query(User).get(int(g.current_user_id))
        if not u:
            return _error("user_not_found", 404)
        _reset_if_needed(u, db)
        if not u.is_premium and (u.credits is None or int(u.credits) < FREE_CREDITS):
            u.credits = FREE_CREDITS
            db.add(u)
            db.commit()
        payload = {
            "ok": True,
            "credits": None if u.is_premium else int(u.credits),
            "is_premium": bool(u.is_premium),
            "reset_at": (u.credits_reset_at.isoformat() + "Z") if u.credits_reset_at else None,
        }
        return jsonify(payload)
    finally:
        db.close()


@bp_credits.post("/grant")
def grant():
    if not ALLOW_ADMIN:
        return _error("forbidden", 403)
    # simple shared-secret guard
    secret = request.headers.get("X-Admin-Secret") or (request.get_json(silent=True) or {}).get("secret")
    if not secret or secret != ADMIN_SECRET:
        return _error("unauthorized", 401)

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    delta = int(data.get("delta") or 0)
    if not email or delta == 0:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            return _error("user_not_found", 404)
        u.credits = int(u.credits) + delta
        db.add(u)
        db.add(CreditTx(user_id=u.id, delta=delta, reason="admin_grant"))
        db.commit()
        return jsonify({"ok": True, "credits_after": int(u.credits)})
    except Exception as e:
        db.rollback()
        current_app.logger.error(f"grant_error: {e}")
        return _error("server_error", 500)
    finally:
        db.close()
