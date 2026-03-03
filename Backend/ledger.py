from sqlalchemy import func

from Backend.db import get_session
from Backend.models import CreditLedger


def get_credit_balance(user_id: int, db=None) -> int:
    own_session = db is None
    if own_session:
        db = get_session()
    try:
        total = (
            db.query(func.coalesce(func.sum(CreditLedger.delta), 0))
            .filter(CreditLedger.user_id == int(user_id))
            .scalar()
        )
        return int(total or 0)
    finally:
        if own_session:
            db.close()


def add_ledger_entry(user_id: int, delta: int, reason: str = None, ref_type: str = None, ref_id: str = None, db=None):
    own_session = db is None
    if own_session:
        db = get_session()
    try:
        entry = CreditLedger(
            user_id=int(user_id),
            delta=int(delta),
            reason=reason,
            ref_type=ref_type,
            ref_id=ref_id,
        )
        db.add(entry)
        if own_session:
            db.commit()
        return entry
    except Exception:
        if own_session:
            db.rollback()
        raise
    finally:
        if own_session:
            db.close()

