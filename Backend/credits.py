from flask import Blueprint, request, jsonify
from sqlalchemy import desc

from Backend.db import get_session
from Backend.models import User, CreditLedger
from Backend.middleware import require_verified_email, require_admin, _error
from Backend.ledger import get_credit_balance, add_ledger_entry


bp_credits = Blueprint("credits", __name__, url_prefix="/credits")


@bp_credits.get("/balance")
@require_verified_email
def balance():
    from flask import g

    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        credits = get_credit_balance(user.id, db=db)
        payload = {
            "ok": True,
            "credits": credits,
            "is_premium": bool(user.is_premium),
            "reset_at": None,
        }
        return jsonify(payload)
    finally:
        db.close()


@bp_credits.get("/ledger")
@require_verified_email
def ledger():
    from flask import g

    limit = min(int(request.args.get("limit", 50) or 50), 200)
    db = get_session()
    try:
        rows = (
            db.query(CreditLedger)
            .filter(CreditLedger.user_id == int(g.current_user_id))
            .order_by(desc(CreditLedger.created_at))
            .limit(limit)
            .all()
        )
        items = [
            {
                "id": row.id,
                "delta": int(row.delta),
                "reason": row.reason,
                "ref_type": row.ref_type,
                "ref_id": row.ref_id,
                "created_at": (row.created_at.isoformat() + "Z") if row.created_at else None,
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
    if not email or delta == 0:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return _error("user_not_found", 404)
        add_ledger_entry(
            user.id,
            delta,
            reason="admin_grant",
            ref_type="admin",
            ref_id=str(user.id),
            db=db,
        )
        db.commit()
        return jsonify({"ok": True, "credits_after": get_credit_balance(user.id, db=db)})
    except Exception:
        db.rollback()
        return _error("server_error", 500)
    finally:
        db.close()
