import os
import datetime as dt
from flask import Blueprint, request, jsonify, current_app

from Backend.db import get_session
from Backend.models import User
from Backend.middleware import create_password_hash, check_password, create_jwt, _error


bp_auth = Blueprint("auth", __name__, url_prefix="/auth")


def _sanitize_user(u: User):
    return {
        "id": u.id,
        "email": u.email,
        "is_premium": bool(u.is_premium),
        "credits": int(u.credits),
        "credits_reset_at": (u.credits_reset_at.isoformat() + "Z") if u.credits_reset_at else None,
    }


@bp_auth.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password or len(password) < 8:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        exists = db.query(User).filter(User.email == email).first()
        if exists:
            return jsonify({"ok": False, "error": "email_exists"}), 400
        u = User(
            email=email,
            pw_hash=create_password_hash(password),
            is_premium=False,
            credits=0,
            credits_reset_at=None,
        )
        db.add(u)
        db.commit()
        current_app.logger.info(f"Registered new user {email}")
        return jsonify({"ok": True})
    except Exception as e:
        db.rollback()
        current_app.logger.error(f"register_error: {e}")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        u = db.query(User).filter(User.email == email).first()
        if not u or not check_password(password, u.pw_hash):
            return _error("invalid_credentials", 401)
        token = create_jwt(u.id)
        return jsonify({"ok": True, "token": token, "user": _sanitize_user(u)})
    except Exception as e:
        current_app.logger.error(f"login_error: {e}")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.get("/me")
def me():
    # Use token if present; return error if missing
    from Backend.middleware import jwt_required

    @jwt_required
    def _inner():
        from flask import g
        db = get_session()
        try:
            u = db.query(User).get(int(g.current_user_id))
            if not u:
                return _error("user_not_found", 404)
            return jsonify({"ok": True, "user": _sanitize_user(u)})
        finally:
            db.close()

    return _inner()

