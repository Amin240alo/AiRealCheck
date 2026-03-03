from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import func

from Backend.db import get_session
from Backend.models import User, CreditLedger
from Backend.middleware import require_admin, create_password_hash, _error
from Backend.ledger import add_ledger_entry, get_credit_balance


bp_admin = Blueprint("admin", __name__, url_prefix="/admin")


def _sanitize_user(u: User, balance: int = None):
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "email_verified": bool(u.email_verified),
        "role": u.role,
        "is_admin": u.role == "admin",
        "is_premium": bool(u.is_premium),
        "credits": balance,
        "created_at": (u.created_at.isoformat() + "Z") if u.created_at else None,
        "updated_at": (u.updated_at.isoformat() + "Z") if u.updated_at else None,
    }


@bp_admin.get("/users")
@require_admin
def list_users():
    db = get_session()
    try:
        users = db.query(User).order_by(User.created_at.desc()).all()
        balances = dict(
            db.query(
                CreditLedger.user_id, func.coalesce(func.sum(CreditLedger.delta), 0)
            ).group_by(CreditLedger.user_id)
        )
        payload = [_sanitize_user(u, int(balances.get(u.id, 0))) for u in users]
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
        balance = get_credit_balance(u.id, db=db)
        return jsonify({"ok": True, "user": _sanitize_user(u, balance)})
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
        current = get_credit_balance(u.id, db=db)
        delta = target - current
        if delta != 0:
            add_ledger_entry(u.id, delta, reason="admin_set", ref_type="admin", ref_id=str(u.id), db=db)
            db.commit()
        return jsonify({"ok": True, "credits": get_credit_balance(u.id, db=db)})
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
    plan = (data.get("plan") or "").strip().lower()
    if plan not in {"free", "premium"}:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        u = db.query(User).get(int(user_id))
        if not u:
            return _error("user_not_found", 404)
        u.is_premium = (plan == "premium")
        db.add(u)
        db.commit()
        return jsonify({"ok": True, "is_premium": bool(u.is_premium)})
    except Exception as e:
        db.rollback()
        current_app.logger.exception("admin_set_plan_error")
        return _error("server_error", 500)
    finally:
        db.close()
