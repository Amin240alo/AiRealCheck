from flask import Blueprint, request, jsonify, current_app
from Backend.db import get_session
from Backend.models import User
from Backend.middleware import require_admin, create_password_hash, _error
from Backend.credits import get_available, grant_credits


bp_admin = Blueprint("admin", __name__, url_prefix="/admin")
bp_api_admin = Blueprint("api_admin", __name__, url_prefix="/api/admin")


def _is_premium_user(u: User) -> bool:
    plan = (u.plan_type or "free").strip().lower()
    if plan == "free":
        return False
    return bool(u.subscription_active)


def _sanitize_user(u: User, balance: int = None):
    available = get_available(u)
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "email_verified": bool(u.email_verified),
        "role": u.role,
        "is_admin": u.role == "admin",
        "is_premium": _is_premium_user(u),
        "plan_type": (u.plan_type or "free"),
        "subscription_active": bool(u.subscription_active),
        "credits_total": int(u.credits_total or 0),
        "credits_used": int(u.credits_used or 0),
        "credits_available": available,
        "credits": available if balance is None else balance,
        "created_at": (u.created_at.isoformat() + "Z") if u.created_at else None,
        "updated_at": (u.updated_at.isoformat() + "Z") if u.updated_at else None,
    }


@bp_admin.get("/users")
@require_admin
def list_users():
    db = get_session()
    try:
        users = db.query(User).order_by(User.created_at.desc()).all()
        payload = [_sanitize_user(u) for u in users]
        return jsonify({"ok": True, "users": payload})
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
        u.password_hash = create_password_hash(new_password)
        db.add(u)
        db.commit()
        return jsonify({"ok": True})
    except Exception as e:
        db.rollback()
        current_app.logger.exception("admin_reset_password_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_admin.post("/users/<int:user_id>/update_credits")
@require_admin
def update_credits(user_id: int):
    data = request.get_json(silent=True) or {}
    try:
        target = int(data.get("credits"))
    except Exception:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        current = get_available(u)
        delta = int(target) - int(current)
        if delta != 0:
            _, available = grant_credits(db, u.id, delta, kind="admin_adjust", note="admin_set")
            return jsonify({"ok": True, "credits": available})
        return jsonify({"ok": True, "credits": current})
    except ValueError:
        db.rollback()
        return _error("invalid_input", 400)
    except Exception as e:
        db.rollback()
        current_app.logger.exception("admin_update_credits_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_admin.post("/users/<int:user_id>/set_role")
@require_admin
def set_role(user_id: int):
    data = request.get_json(silent=True) or {}
    role = (data.get("role") or "").strip().lower()
    if role not in {"user", "admin"}:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        u.role = role
        db.add(u)
        db.commit()
        return jsonify({"ok": True, "role": u.role})
    except Exception as e:
        db.rollback()
        current_app.logger.exception("admin_set_role_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_admin.post("/users/<int:user_id>/set_plan")
@require_admin
def set_plan(user_id: int):
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan_type") or data.get("plan") or "").strip().lower()
    if plan == "premium":
        plan = "pro"
    if plan not in {"free", "basic", "pro", "business"}:
        return _error("invalid_input", 400)
    subscription_active = data.get("subscription_active")
    if subscription_active is None:
        subscription_active = plan != "free"

    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        u.plan_type = plan
        u.subscription_active = bool(subscription_active)
        u.is_premium = bool(u.subscription_active and plan != "free")
        db.add(u)
        db.commit()
        return jsonify({"ok": True, "plan_type": u.plan_type, "subscription_active": bool(u.subscription_active)})
    except Exception as e:
        db.rollback()
        current_app.logger.exception("admin_set_plan_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_api_admin.post("/users/<int:user_id>/credits/grant")
@require_admin
def api_grant_credits(user_id: int):
    data = request.get_json(silent=True) or {}
    try:
        amount = int(data.get("amount"))
    except Exception:
        return _error("invalid_input", 400)
    note = data.get("note")
    db = get_session()
    try:
        _, available = grant_credits(
            db,
            user_id,
            amount,
            kind="admin_adjust",
            note=note or "admin_adjust",
        )
        return jsonify({"ok": True, "credits_available": available})
    except ValueError:
        db.rollback()
        return _error("invalid_input", 400)
    except Exception:
        db.rollback()
        current_app.logger.exception("admin_grant_credits_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_api_admin.post("/users/<int:user_id>/plan")
@require_admin
def api_set_plan(user_id: int):
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan_type") or "").strip().lower()
    if plan not in {"free", "basic", "pro", "business"}:
        return _error("invalid_input", 400)
    subscription_active = bool(data.get("subscription_active"))

    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        u.plan_type = plan
        u.subscription_active = subscription_active
        u.is_premium = bool(subscription_active and plan != "free")
        db.add(u)
        db.commit()
        return jsonify(
            {
                "ok": True,
                "plan_type": u.plan_type,
                "subscription_active": bool(u.subscription_active),
            }
        )
    except Exception:
        db.rollback()
        current_app.logger.exception("admin_set_plan_error")
        return _error("server_error", 500)
    finally:
        db.close()
