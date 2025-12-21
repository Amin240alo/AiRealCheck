import datetime as dt
from flask import Blueprint, request, jsonify, current_app

from Backend.db import get_session
from Backend.models import User
from Backend.middleware import require_admin, create_password_hash, _error


bp_admin = Blueprint("admin", __name__, url_prefix="/admin")


def _sanitize_user(u: User):
    return {
        "id": u.id,
        "email": u.email,
        "is_premium": bool(u.is_premium),
        "is_admin": bool(getattr(u, "is_admin", False)),
        "credits": int(u.credits),
        "credits_reset_at": (u.credits_reset_at.isoformat() + "Z") if u.credits_reset_at else None,
        "created_at": (u.created_at.isoformat() + "Z") if u.created_at else None,
    }


@bp_admin.get("/users")
@require_admin
def list_users():
    db = get_session()
    try:
        users = db.query(User).order_by(User.created_at.desc()).all()
        return jsonify({"ok": True, "users": [_sanitize_user(u) for u in users]})
    finally:
        db.close()


@bp_admin.get("/users/<int:user_id>")
@require_admin
def get_user(user_id: int):
    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        return jsonify({"ok": True, "user": _sanitize_user(u)})
    finally:
        db.close()


@bp_admin.post("/users/<int:user_id>/reset_password")
@require_admin
def reset_password(user_id: int):
    data = request.get_json(silent=True) or {}
    new_password = data.get("new_password") or ""
    if len(new_password) < 8:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        u.pw_hash = create_password_hash(new_password)
        db.add(u)
        db.commit()
        return jsonify({"ok": True})
    except Exception as e:
        db.rollback()
        current_app.logger.error(f"admin_reset_password_error: {e}")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_admin.post("/users/<int:user_id>/update_credits")
@require_admin
def update_credits(user_id: int):
    data = request.get_json(silent=True) or {}
    try:
        credits = int(data.get("credits"))
    except Exception:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        u.credits = credits
        db.add(u)
        db.commit()
        return jsonify({"ok": True, "credits": int(u.credits)})
    except Exception as e:
        db.rollback()
        current_app.logger.error(f"admin_update_credits_error: {e}")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_admin.post("/users/<int:user_id>/set_plan")
@require_admin
def set_plan(user_id: int):
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan") or "").strip().lower()
    if plan not in {"free", "premium"}:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        u.is_premium = (plan == "premium")
        if not u.is_premium and not u.credits_reset_at:
            u.credits_reset_at = dt.datetime.utcnow()
        db.add(u)
        db.commit()
        return jsonify({"ok": True, "is_premium": bool(u.is_premium)})
    except Exception as e:
        db.rollback()
        current_app.logger.error(f"admin_set_plan_error: {e}")
        return _error("server_error", 500)
    finally:
        db.close()
