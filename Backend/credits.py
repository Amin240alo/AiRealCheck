import datetime as dt
import math
import os

from flask import Blueprint, request, jsonify, g
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError

from Backend.db import get_session
from Backend.models import User, CreditTransaction
from Backend.middleware import require_verified_email, require_admin, _error

COST_IMAGE = int(os.getenv("AIREALCHECK_COST_IMAGE", "15") or 15)
COST_AUDIO = int(os.getenv("AIREALCHECK_COST_AUDIO", "20") or 20)
COST_VIDEO_SHORT = int(os.getenv("AIREALCHECK_COST_VIDEO_SHORT", "30") or 30)
COST_VIDEO_PER_SEC = int(os.getenv("AIREALCHECK_COST_VIDEO_PER_SEC", "1") or 1)
RESET_DAYS = int(os.getenv("AIREALCHECK_CREDIT_RESET_DAYS", "30") or 30)


class InsufficientCredits(Exception):
    def __init__(self, available=None):
        super().__init__("insufficient_credits")
        self.available = available


bp_credits = Blueprint("credits", __name__, url_prefix="/credits")
bp_api_credits = Blueprint("api_credits", __name__, url_prefix="/api/credits")


def _utcnow():
    return dt.datetime.now(dt.timezone.utc)


def _normalize_dt(value):
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value


def _is_premium_user(user: User) -> bool:
    plan = (user.plan_type or "free").strip().lower()
    if plan == "free":
        return False
    return bool(user.subscription_active)


def _iso(dt_value):
    if not dt_value:
        return None
    value = _normalize_dt(dt_value)
    return value.isoformat().replace("+00:00", "Z")


def get_cost(media_type: str, duration_sec=None) -> int:
    kind = (media_type or "").strip().lower()
    if kind == "audio":
        return COST_AUDIO
    if kind == "video":
        duration = None
        try:
            duration = float(duration_sec)
        except Exception:
            duration = None
        if duration is None or duration < 30.0:
            return COST_VIDEO_SHORT
        per_sec = max(1, int(COST_VIDEO_PER_SEC or 1))
        return int(math.ceil(duration)) * per_sec
    return COST_IMAGE


def get_available(user: User) -> int:
    if not user:
        return 0
    try:
        total = int(user.credits_total or 0)
    except Exception:
        total = 0
    try:
        used = int(user.credits_used or 0)
    except Exception:
        used = 0
    if used < 0:
        used = 0
    return max(0, total - used)


def maybe_reset_credits(db, user: User):
    if not user:
        return user
    now = _utcnow()
    if user.credits_total is None:
        user.credits_total = 0
    if user.credits_used is None:
        user.credits_used = 0
    last_reset = _normalize_dt(user.last_credit_reset)
    if not last_reset:
        user.last_credit_reset = now
        db.add(user)
        return user
    if now - last_reset >= dt.timedelta(days=RESET_DAYS):
        user.credits_used = 0
        user.last_credit_reset = now
        db.add(user)
        db.add(
            CreditTransaction(
                user_id=int(user.id),
                kind="reset",
                amount=0,
                note="rolling_30d_reset",
            )
        )
    return user


def ensure_has_credits(db, user_id: int, cost: int):
    try:
        cost_value = int(cost or 0)
    except Exception:
        cost_value = 0
    with db.begin():
        user = (
            db.query(User)
            .filter(User.id == int(user_id))
            .with_for_update()
            .first()
        )
        if not user:
            raise ValueError("user_not_found")
        maybe_reset_credits(db, user)
        available = get_available(user)
        ok = available >= cost_value
        return ok, available


def _is_idempotency_violation(exc: IntegrityError) -> bool:
    raw = str(getattr(exc, "orig", exc)).lower()
    return (
        "idempotency_key" in raw
        or "ix_credit_transactions_idempotency_key" in raw
        or "credit_transactions.idempotency_key" in raw
        or "unique constraint failed: credit_transactions.idempotency_key" in raw
    )


def charge_credits_on_success(
    db,
    user_id: int,
    cost: int,
    media_type: str,
    analysis_id: str,
    idempotency_key: str,
):
    try:
        cost_value = int(cost or 0)
    except Exception:
        cost_value = 0
    if cost_value <= 0:
        return False, None
    if not idempotency_key:
        raise ValueError("idempotency_key_required")
    try:
        with db.begin():
            user = (
                db.query(User)
                .filter(User.id == int(user_id))
                .with_for_update()
                .first()
            )
            if not user:
                raise ValueError("user_not_found")
            maybe_reset_credits(db, user)
            available = get_available(user)
            if available < cost_value:
                raise InsufficientCredits(available=available)
            entry = CreditTransaction(
                user_id=int(user_id),
                kind="charge",
                amount=-int(cost_value),
                analysis_id=str(analysis_id) if analysis_id else None,
                media_type=(media_type or None),
                idempotency_key=str(idempotency_key),
            )
            db.add(entry)
            db.flush()
            user.credits_used = int(user.credits_used or 0) + int(cost_value)
            db.add(user)
            available_after = get_available(user)
        return True, available_after
    except IntegrityError as exc:
        db.rollback()
        if not _is_idempotency_violation(exc):
            raise
        with db.begin():
            user = (
                db.query(User)
                .filter(User.id == int(user_id))
                .with_for_update()
                .first()
            )
            if not user:
                return False, None
            maybe_reset_credits(db, user)
            available = get_available(user)
        return False, available


def grant_credits(db, user_id: int, amount: int, kind: str = "grant", note: str = None):
    try:
        amt = int(amount or 0)
    except Exception:
        raise ValueError("invalid_amount")
    if amt == 0:
        raise ValueError("invalid_amount")
    started_in_tx = db.in_transaction()
    ctx = db.begin_nested() if started_in_tx else db.begin()
    try:
        with ctx:
            user = (
                db.query(User)
                .filter(User.id == int(user_id))
                .with_for_update()
                .first()
            )
            if not user:
                raise ValueError("user_not_found")
            maybe_reset_credits(db, user)
            new_total = int(user.credits_total or 0) + int(amt)
            if new_total < 0:
                raise ValueError("credits_total_negative")
            user.credits_total = int(new_total)
            db.add(
                CreditTransaction(
                    user_id=int(user_id),
                    kind=str(kind or "grant"),
                    amount=int(amt),
                    note=note,
                )
            )
            db.add(user)
            available = get_available(user)
        if started_in_tx:
            db.commit()
    except Exception:
        db.rollback()
        raise
    return user, available


def _credit_payload(user: User):
    return {
        "plan_type": (user.plan_type or "free"),
        "subscription_active": bool(user.subscription_active),
        "credits_total": int(user.credits_total or 0),
        "credits_used": int(user.credits_used or 0),
        "credits_available": get_available(user),
        "last_credit_reset": _iso(user.last_credit_reset),
    }


@bp_api_credits.get("")
@require_verified_email
def api_credits():
    db = get_session()
    try:
        with db.begin():
            user = (
                db.query(User)
                .filter(User.id == int(g.current_user_id))
                .with_for_update()
                .first()
            )
            if not user:
                return _error("user_not_found", 404)
            maybe_reset_credits(db, user)
            payload = _credit_payload(user)
        return jsonify(payload)
    finally:
        db.close()


@bp_api_credits.get("/ledger")
@require_verified_email
def api_ledger():
    limit = min(int(request.args.get("limit", 50) or 50), 200)
    db = get_session()
    try:
        rows = (
            db.query(CreditTransaction)
            .filter(CreditTransaction.user_id == int(g.current_user_id))
            .order_by(desc(CreditTransaction.created_at))
            .limit(limit)
            .all()
        )
        items = [
            {
                "id": row.id,
                "kind": row.kind,
                "amount": int(row.amount),
                "analysis_id": row.analysis_id,
                "media_type": row.media_type,
                "note": row.note,
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ]
        return jsonify({"ok": True, "items": items})
    finally:
        db.close()


@bp_credits.get("/balance")
@require_verified_email
def balance():
    db = get_session()
    try:
        with db.begin():
            user = (
                db.query(User)
                .filter(User.id == int(g.current_user_id))
                .with_for_update()
                .first()
            )
            if not user:
                return _error("user_not_found", 404)
            maybe_reset_credits(db, user)
            credits = get_available(user)
            payload = {
                "ok": True,
                "credits": credits,
                "is_premium": _is_premium_user(user),
                "reset_at": _iso(user.last_credit_reset),
            }
        return jsonify(payload)
    finally:
        db.close()


@bp_credits.get("/ledger")
@require_verified_email
def ledger():
    limit = min(int(request.args.get("limit", 50) or 50), 200)
    db = get_session()
    try:
        rows = (
            db.query(CreditTransaction)
            .filter(CreditTransaction.user_id == int(g.current_user_id))
            .order_by(desc(CreditTransaction.created_at))
            .limit(limit)
            .all()
        )
        items = [
            {
                "id": row.id,
                "delta": int(row.amount),
                "reason": row.kind,
                "ref_type": row.media_type,
                "ref_id": row.analysis_id or row.idempotency_key,
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ]
        return jsonify({"ok": True, "items": items})
    finally:
        db.close()


@bp_credits.post("/grant")
@require_admin
def grant():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    delta = int(data.get("delta") or 0)
    note = data.get("note")
    if not email or delta == 0:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return _error("user_not_found", 404)
        _, available = grant_credits(
            db,
            user.id,
            delta,
            kind="admin_adjust",
            note=note or "admin_grant",
        )
        return jsonify({"ok": True, "credits_after": available})
    except ValueError:
        db.rollback()
        return _error("invalid_input", 400)
    except Exception:
        db.rollback()
        return _error("server_error", 500)
    finally:
        db.close()
