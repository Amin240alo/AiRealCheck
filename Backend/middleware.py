import os
import time
import datetime as dt
from functools import wraps
from flask import request, jsonify, g, current_app
import jwt
import bcrypt

from Backend.db import get_session
from Backend.models import User, CreditTx


JWT_SECRET = os.getenv("AIREALCHECK_JWT_SECRET", "dev_change_me")
FREE_CREDITS = int(os.getenv("AIREALCHECK_FREE_CREDITS", "100") or 100)


def _error(error: str, status: int = 400, details=None):
    return jsonify({"ok": False, "error": error, "details": details or []}), status


def create_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(password: str, pw_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), pw_hash.encode("utf-8"))
    except Exception:
        return False


def create_jwt(user_id: int) -> str:
    exp = dt.datetime.utcnow() + dt.timedelta(days=7)
    payload = {"sub": str(user_id), "exp": exp}
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def parse_auth_header():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return auth.split(" ", 1)[1].strip()


def jwt_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = parse_auth_header()
        if not token:
            return _error("auth_required", 401)
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])  # raises on invalid/expired
        except jwt.ExpiredSignatureError:
            return _error("token_expired", 401)
        except Exception:
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
        g.current_user_id = user.id
        g.current_user_is_premium = bool(user.is_premium)
        g.current_user_is_admin = bool(getattr(user, "is_admin", False))
        return fn(*args, **kwargs)
    return wrapper


def require_admin(fn):
    @wraps(fn)
    @jwt_required
    def wrapper(*args, **kwargs):
        if not bool(getattr(g, "current_user_is_admin", False)):
            return _error("forbidden", 403)
        return fn(*args, **kwargs)
    return wrapper


def get_current_user():
    db = get_session()
    try:
        user = db.query(User).get(int(getattr(g, "current_user_id", 0)))
        return user, db
    except Exception:
        db.close()
        raise


def _today_reset_at_utc():
    now = dt.datetime.utcnow()
    return dt.datetime(year=now.year, month=now.month, day=now.day, hour=0, minute=0, second=0, microsecond=0) + dt.timedelta(days=1)


def ensure_daily_reset(user: User, db):
    if user.is_premium:
        return False
    now = dt.datetime.utcnow()
    reset_at = user.credits_reset_at
    if not reset_at or now >= reset_at:
        user.credits = FREE_CREDITS
        user.credits_reset_at = _today_reset_at_utc()
        db.add(user)
        db.flush()
        return True
    return False


def require_credits(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user, db = get_current_user()
        try:
            if user is None:
                return _error("auth_required", 401)
            # Reset check before verifying credits
            ensure_daily_reset(user, db)
            if not user.is_premium and user.credits <= 0:
                return _error("no_credits", 402)
            return fn(*args, **kwargs)
        finally:
            db.close()
    return wrapper


def spend_one_credit(user_id: int, reason: str = "analyze") -> int:
    """Atomar 1 Credit abziehen, wenn user nicht premium. Gibt Credits danach zurueck."""
    db = get_session()
    try:
        user = db.query(User).with_for_update(read=True, nowait=False).get(int(user_id)) if hasattr(db.query(User), 'with_for_update') else db.query(User).get(int(user_id))
        if not user:
            raise ValueError("user_not_found")
        if user.is_premium:
            return user.credits
        # Ensure reset before spending
        ensure_daily_reset(user, db)
        if user.credits <= 0:
            raise ValueError("no_credits")
        user.credits -= 1
        tx = CreditTx(user_id=user.id, delta=-1, reason=reason)
        db.add(user)
        db.add(tx)
        db.commit()
        return user.credits
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
