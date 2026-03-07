import os
import time
import datetime as dt
import hashlib
from functools import wraps
from flask import request, jsonify, g
import jwt
import bcrypt

from Backend.db import get_session
from Backend.models import User
from Backend.runtime import is_production


JWT_SECRET = os.getenv("AIREALCHECK_JWT_SECRET", "dev_change_me")
ACCESS_TOKEN_MINUTES = int(os.getenv("AIREALCHECK_ACCESS_TOKEN_MINUTES", "15") or 15)
ADMIN_ALLOWED = os.getenv("AIREALCHECK_ALLOW_ADMIN", "false").lower() in {"1", "true", "yes", "on"}

_RATE_BUCKET = {}


def _assert_jwt_secret():
    if not is_production():
        return
    secret = (JWT_SECRET or "").strip()
    if not secret or secret == "dev_change_me":
        raise RuntimeError(
            "AIREALCHECK_JWT_SECRET must be set to a secure value in production."
        )


_assert_jwt_secret()


def _error(error: str, status: int = 400, details=None):
    return jsonify({"ok": False, "error": error, "details": details or []}), status


def create_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user: User) -> str:
    exp = dt.datetime.utcnow() + dt.timedelta(minutes=ACCESS_TOKEN_MINUTES)
    payload = {"sub": str(user.id), "role": user.role, "typ": "access", "exp": exp}
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def parse_auth_header():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return auth.split(" ", 1)[1].strip()


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = parse_auth_header()
        if not token:
            return _error("auth_required", 401)
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return _error("token_expired", 401)
        except Exception:
            return _error("invalid_token", 401)
        if payload.get("typ") not in (None, "access"):
            return _error("invalid_token", 401)
        user_id = payload.get("sub")
        if not user_id:
            return _error("invalid_token", 401)
        db = get_session()
        try:
            user = db.query(User).get(int(user_id))
        finally:
            db.close()
        if not user:
            return _error("user_not_found", 404)
        if bool(getattr(user, "is_banned", False)):
            return _error("user_banned", 403)
        g.current_user_id = user.id
        g.current_user_role = user.role
        g.current_user_email_verified = bool(user.email_verified)
        g.current_user_is_admin = user.role == "admin"
        g.current_user_is_banned = bool(getattr(user, "is_banned", False))
        return fn(*args, **kwargs)
    return wrapper


def require_admin(fn):
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        if not bool(getattr(g, "current_user_is_admin", False)):
            return _error("forbidden", 403)
        if not ADMIN_ALLOWED:
            return _error("admin_disabled", 403)
        return fn(*args, **kwargs)
    return wrapper


def require_email_verified(fn):
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        if not bool(getattr(g, "current_user_email_verified", False)):
            return _error("email_not_verified", 403)
        return fn(*args, **kwargs)
    return wrapper


def require_verified_email(fn):
    return require_email_verified(fn)


def get_current_user():
    db = get_session()
    try:
        user = db.query(User).get(int(getattr(g, "current_user_id", 0)))
        return user, db
    except Exception:
        db.close()
        raise


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def rate_limit(key: str, limit: int, window_sec: int) -> bool:
    now = int(time.time())
    bucket = _RATE_BUCKET.get(key, [])
    bucket = [t for t in bucket if now - t < window_sec]
    if len(bucket) >= limit:
        _RATE_BUCKET[key] = bucket
        return False
    bucket.append(now)
    _RATE_BUCKET[key] = bucket
    return True
