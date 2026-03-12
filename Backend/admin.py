import datetime as dt
import json
import os

from flask import Blueprint, request, jsonify, current_app, g
from sqlalchemy import func, desc, or_, cast, String

from Backend.db import get_session, using_sqlite
from Backend.models import User, AnalysisHistory, CreditTransaction, AdminLog, RefreshToken
from Backend.middleware import require_admin, create_password_hash, _error
from Backend.credits import get_available, grant_credits
from Backend.runtime import is_production, is_dev, is_test, is_debug
from Backend.emailer import email_debug_status


bp_admin = Blueprint("admin", __name__, url_prefix="/admin")
bp_api_admin = Blueprint("api_admin", __name__, url_prefix="/api/admin")


def _parse_int(value, default):
    try:
        return int(value)
    except Exception:
        return default


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _parse_date_str(value: str):
    if not value:
        return None
    try:
        parsed = dt.date.fromisoformat(value)
        return parsed.isoformat()
    except Exception:
        return None


def _truncate_text(raw, max_len=6000):
    if raw is None:
        return None, False
    text = str(raw)
    if len(text) > max_len:
        return text[:max_len] + "...", True
    return text, False


def _iso(dt_value):
    if not dt_value:
        return None
    if getattr(dt_value, "tzinfo", None) is None:
        return dt_value.isoformat() + "Z"
    return dt_value.isoformat().replace("+00:00", "Z")


def _safe_json_load(raw):
    if raw is None:
        return None
    if isinstance(raw, (dict, list)):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return None


def _engine_summary(raw):
    payload = _safe_json_load(raw)
    engines = []
    if isinstance(payload, dict):
        engines = [str(key) for key in payload.keys() if key]
    elif isinstance(payload, list):
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            name = (entry.get("engine") or "").strip()
            if name:
                engines.append(name)
    if not engines:
        return ""
    engines = list(dict.fromkeys(engines))
    if len(engines) <= 4:
        return ", ".join(engines)
    return ", ".join(engines[:4]) + f" +{len(engines) - 4}"


def _engine_names(raw):
    payload = _safe_json_load(raw)
    engines = []
    if isinstance(payload, dict):
        engines = [str(key) for key in payload.keys() if key]
    elif isinstance(payload, list):
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            name = (entry.get("engine") or "").strip()
            if name:
                engines.append(name)
    elif isinstance(raw, str):
        for chunk in raw.split(","):
            name = chunk.strip()
            if name:
                engines.append(name)
    if not engines:
        return []
    return list(dict.fromkeys(engines))


def _env_flag(name, default="false"):
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


def _has_any_env(*names):
    for name in names:
        if (os.getenv(name) or "").strip():
            return True
    return False


def _active_engines():
    paid_enabled = _env_flag("AIREALCHECK_USE_PAID_APIS", "false")
    local_ml = _env_flag("AIREALCHECK_USE_LOCAL_ML", "true")
    engines = []

    # Image engines
    engines.extend(["c2pa", "watermark"])
    if _env_flag("AIREALCHECK_IMAGE_FALLBACK", "true"):
        engines.append("forensics")
    if local_ml:
        engines.extend(["xception", "clip_detector"])
    if _env_flag("AIREALCHECK_ENABLE_HIVE_IMAGE", "false") and _has_any_env(
        "HIVE_API_KEY", "HIVE_API_KEY_ID", "HIVE_API_SECRET"
    ):
        engines.append("hive")
    if (
        _env_flag("AIREALCHECK_ENABLE_SIGHTENGINE_IMAGE", "false")
        and paid_enabled
        and _has_any_env("SIGHTENGINE_API_KEY", "SIGHTENGINE_API_USER", "SIGHTENGINE_API_SECRET")
    ):
        engines.append("sightengine")
    if (
        _env_flag("AIREALCHECK_ENABLE_REALITY_DEFENDER_IMAGE", "false")
        and paid_enabled
        and _has_any_env("REALITY_DEFENDER_API_KEY")
    ):
        engines.append("reality_defender")
    if _env_flag("AIREALCHECK_ENABLE_SENSITY_IMAGE", "false") and paid_enabled and _has_any_env(
        "SENSITY_API_KEY"
    ):
        engines.append("sensity_image")

    # Video engines
    engines.extend(["video_forensics", "video_temporal"])
    if local_ml and _env_flag("AIREALCHECK_ENABLE_VIDEO_TEMPORAL_CNN", "true"):
        engines.append("video_temporal_cnn")
    video_api_enabled = False
    if _env_flag("AIREALCHECK_ENABLE_HIVE_VIDEO", "false") and paid_enabled and _has_any_env(
        "HIVE_API_KEY", "HIVE_API_KEY_ID", "HIVE_API_SECRET"
    ):
        engines.append("hive_video")
        video_api_enabled = True
    if (
        _env_flag("AIREALCHECK_ENABLE_SIGHTENGINE_VIDEO", "false")
        and paid_enabled
        and _has_any_env("SIGHTENGINE_API_KEY", "SIGHTENGINE_API_USER", "SIGHTENGINE_API_SECRET")
    ):
        engines.append("sightengine_video")
        video_api_enabled = True
    if (
        _env_flag("AIREALCHECK_ENABLE_REALITY_DEFENDER_VIDEO", "false")
        and paid_enabled
        and _has_any_env("REALITY_DEFENDER_API_KEY")
    ):
        engines.append("reality_defender_video")
        video_api_enabled = True
    if _env_flag("AIREALCHECK_ENABLE_SENSITY_VIDEO", "false") and paid_enabled and _has_any_env(
        "SENSITY_API_KEY"
    ):
        engines.append("sensity_video")
        video_api_enabled = True
    if video_api_enabled:
        engines.append("video_frame_detectors")

    # Audio engines
    if _env_flag("AIREALCHECK_ENABLE_AUDIO_AASIST", "true"):
        engines.append("audio_aasist")
    if _env_flag("AIREALCHECK_ENABLE_AUDIO_FORENSICS", "true"):
        engines.append("audio_forensics")
    if _env_flag("AIREALCHECK_ENABLE_AUDIO_PROSODY", "true"):
        engines.append("audio_prosody")
    if (
        _env_flag("AIREALCHECK_ENABLE_REALITY_DEFENDER_AUDIO", "false")
        and paid_enabled
        and _has_any_env("REALITY_DEFENDER_API_KEY")
    ):
        engines.append("reality_defender_audio")

    return sorted(set(engines))


def _log_admin_event(db, event: str, meta=None, level="info"):
    try:
        db.add(
            AdminLog(
                level=str(level or "info"),
                event=str(event or "ADMIN_EVENT"),
                meta_json=meta or {},
            )
        )
    except Exception:
        current_app.logger.exception("admin_log_write_failed")

def _is_premium_user(u: User) -> bool:
    plan = (u.plan_type or "free").strip().lower()
    if plan == "free":
        return False
    return bool(u.subscription_active)


def _environment_label():
    if is_test():
        return "test"
    if is_dev():
        return "development"
    if is_debug():
        return "debug"
    if is_production():
        return "production"
    return "unknown"


def _sanitize_user(u: User, balance: int = None, analyses_count: int = None):
    available = get_available(u)
    payload = {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "email_verified": bool(u.email_verified),
        "role": u.role,
        "is_admin": u.role == "admin",
        "is_banned": bool(getattr(u, "is_banned", False)),
        "status": "banned" if bool(getattr(u, "is_banned", False)) else "active",
        "is_premium": _is_premium_user(u),
        "plan_type": (u.plan_type or "free"),
        "subscription_active": bool(u.subscription_active),
        "credits_total": int(u.credits_total or 0),
        "credits_used": int(u.credits_used or 0),
        "credits_available": available,
        "credits": available if balance is None else balance,
        "created_at": _iso(u.created_at),
        "updated_at": _iso(u.updated_at),
        "last_login": _iso(u.last_login),
    }
    if analyses_count is not None:
        payload["analyses_count"] = int(analyses_count or 0)
    return payload


@bp_admin.get("/stats")
@require_admin
def stats():
    today = dt.datetime.utcnow().date().isoformat()
    db = get_session()
    try:
        total_users = db.query(func.count(User.id)).scalar() or 0
        new_users_today = (
            db.query(func.count(User.id))
            .filter(func.date(User.created_at) == today)
            .scalar()
            or 0
        )
        analyses_total = db.query(func.count(AnalysisHistory.id)).scalar() or 0
        analyses_today = (
            db.query(func.count(AnalysisHistory.id))
            .filter(func.date(AnalysisHistory.created_at) == today)
            .scalar()
            or 0
        )
        credits_spent_total = (
            db.query(func.coalesce(func.sum(func.abs(CreditTransaction.amount)), 0))
            .filter(CreditTransaction.kind == "charge")
            .scalar()
            or 0
        )
        credits_spent_today = (
            db.query(func.coalesce(func.sum(func.abs(CreditTransaction.amount)), 0))
            .filter(
                CreditTransaction.kind == "charge",
                func.date(CreditTransaction.created_at) == today,
            )
            .scalar()
            or 0
        )
        errors_today = (
            db.query(func.count(AdminLog.id))
            .filter(AdminLog.level == "error", func.date(AdminLog.ts) == today)
            .scalar()
            or 0
        )
        recent_admin = (
            db.query(AdminLog)
            .order_by(desc(AdminLog.ts))
            .limit(6)
            .all()
        )
        recent_errors = (
            db.query(AdminLog)
            .filter(AdminLog.level == "error")
            .order_by(desc(AdminLog.ts))
            .limit(6)
            .all()
        )
        recent_analyses = (
            db.query(AnalysisHistory)
            .order_by(desc(AnalysisHistory.created_at))
            .limit(8)
            .all()
        )
        top_subq = (
            db.query(
                AnalysisHistory.user_id.label("user_id"),
                func.count(AnalysisHistory.id).label("analyses_count"),
            )
            .group_by(AnalysisHistory.user_id)
            .subquery()
        )
        top_users = (
            db.query(User.id, User.email, top_subq.c.analyses_count)
            .join(top_subq, User.id == top_subq.c.user_id)
            .order_by(desc(top_subq.c.analyses_count))
            .limit(6)
            .all()
        )
        return jsonify(
            {
                "ok": True,
                "total_users": int(total_users),
                "new_users_today": int(new_users_today),
                "analyses_total": int(analyses_total),
                "analyses_today": int(analyses_today),
                "credits_spent_total": int(credits_spent_total),
                "credits_spent_today": int(credits_spent_today),
                "errors_today": int(errors_today),
                "engines_active": _active_engines(),
                "recent_admin_events": [
                    {
                        "id": row.id,
                        "ts": _iso(row.ts),
                        "level": row.level,
                        "event": row.event,
                        "meta": row.meta_json,
                    }
                    for row in recent_admin
                ],
                "recent_error_logs": [
                    {
                        "id": row.id,
                        "ts": _iso(row.ts),
                        "level": row.level,
                        "event": row.event,
                        "meta": row.meta_json,
                    }
                    for row in recent_errors
                ],
                "recent_analyses": [
                    {
                        "id": row.id,
                        "user_id": int(row.user_id),
                        "created_at": _iso(row.created_at),
                        "media_type": row.media_type,
                        "status": row.status,
                        "final_score": int(round(float(row.final_score)))
                        if isinstance(row.final_score, (int, float))
                        else None,
                        "credits_charged": int(row.credits_charged or 0),
                        "verdict_label": row.verdict_label,
                    }
                    for row in recent_analyses
                ],
                "top_users": [
                    {
                        "id": int(row.id),
                        "email": row.email,
                        "analyses_count": int(row.analyses_count or 0),
                    }
                    for row in top_users
                ],
            }
        )
    finally:
        db.close()


@bp_admin.get("/users")
@require_admin
def list_users():
    limit = _parse_int(request.args.get("limit"), 50)
    offset = _parse_int(request.args.get("offset"), 0)
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    q = (request.args.get("q") or "").strip().lower()
    role = (request.args.get("role") or "").strip().lower()
    status = (request.args.get("status") or "").strip().lower()
    sort = (request.args.get("sort") or "").strip().lower()
    banned_raw = request.args.get("banned")
    verified_raw = request.args.get("verified")
    db = get_session()
    try:
        subq = (
            db.query(
                AnalysisHistory.user_id.label("user_id"),
                func.count(AnalysisHistory.id).label("analyses_count"),
            )
            .group_by(AnalysisHistory.user_id)
            .subquery()
        )
        analyses_count_col = func.coalesce(subq.c.analyses_count, 0)
        query = (
            db.query(User, analyses_count_col.label("analyses_count"))
            .outerjoin(subq, User.id == subq.c.user_id)
        )
        if q:
            filters = [User.email.ilike(f"%{q}%")]
            try:
                q_id = int(q)
                filters.append(User.id == q_id)
            except Exception:
                filters.append(cast(User.id, String).ilike(f"%{q}%"))
            query = query.filter(or_(*filters))
        if role in {"admin", "moderator", "user"}:
            query = query.filter(User.role == role)
        if status in {"active", "banned"}:
            query = query.filter(User.is_banned.is_(status == "banned"))
        if banned_raw not in (None, ""):
            query = query.filter(User.is_banned.is_(_parse_bool(banned_raw)))
        if verified_raw not in (None, ""):
            query = query.filter(User.email_verified.is_(_parse_bool(verified_raw)))
        if sort == "top":
            query = query.order_by(desc(analyses_count_col), User.created_at.desc())
        else:
            query = query.order_by(User.created_at.desc())
        rows = query.limit(limit + 1).offset(offset).all()
        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]
        payload = [_sanitize_user(u, analyses_count=count) for u, count in rows]
        return jsonify(
            {"ok": True, "users": payload, "limit": limit, "offset": offset, "has_more": has_more}
        )
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
        analyses_count = (
            db.query(func.count(AnalysisHistory.id))
            .filter(AnalysisHistory.user_id == int(user_id))
            .scalar()
            or 0
        )
        recent = (
            db.query(AnalysisHistory)
            .filter(AnalysisHistory.user_id == int(user_id))
            .order_by(desc(AnalysisHistory.created_at))
            .limit(10)
            .all()
        )
        credit_rows = (
            db.query(CreditTransaction)
            .filter(CreditTransaction.user_id == int(user_id))
            .order_by(desc(CreditTransaction.created_at))
            .limit(10)
            .all()
        )
        last_refresh = (
            db.query(RefreshToken)
            .filter(RefreshToken.user_id == int(user_id))
            .order_by(desc(RefreshToken.created_at))
            .first()
        )
        recent_payload = []
        for row in recent:
            score = None
            if isinstance(row.final_score, (int, float)):
                score = int(round(float(row.final_score)))
            recent_payload.append(
                {
                    "id": row.id,
                    "created_at": _iso(row.created_at),
                    "media_type": row.media_type,
                    "status": row.status,
                    "final_score": score,
                    "credits_charged": int(row.credits_charged or 0),
                }
            )
        payload = _sanitize_user(u, analyses_count=analyses_count)
        payload["last_analyses"] = recent_payload
        payload["credit_history"] = [
            {
                "id": row.id,
                "created_at": _iso(row.created_at),
                "kind": row.kind,
                "amount": int(row.amount or 0),
                "note": row.note,
                "analysis_id": row.analysis_id,
                "media_type": row.media_type,
            }
            for row in credit_rows
        ]
        if last_refresh:
            payload["last_login_ip"] = last_refresh.ip_address
            payload["last_login_user_agent"] = last_refresh.user_agent
        return jsonify({"ok": True, "user": payload})
    finally:
        db.close()


@bp_admin.post("/users/<int:user_id>/credits")
@require_admin
def adjust_credits(user_id: int):
    data = request.get_json(silent=True) or {}
    mode = (data.get("mode") or "").strip().lower()
    try:
        amount = int(data.get("amount"))
    except Exception:
        return _error("invalid_input", 400)
    if amount < 0:
        return _error("invalid_input", 400)
    if mode not in {"set_total", "add", "subtract"}:
        return _error("invalid_input", 400)
    reason = (data.get("reason") or "").strip() or None

    db = get_session()
    try:
        user = (
            db.query(User)
            .filter(User.id == int(user_id))
            .with_for_update()
            .first()
        )
        if not user:
            return _error("user_not_found", 404)
        current_total = int(user.credits_total or 0)
        used = int(user.credits_used or 0)
        if mode == "set_total":
            new_total = int(amount)
        elif mode == "add":
            new_total = current_total + int(amount)
        else:
            new_total = current_total - int(amount)
        if new_total < 0:
            return _error("invalid_input", 400)
        if new_total < used:
            return _error("credits_below_used", 400)
        delta = int(new_total) - int(current_total)
        if delta != 0:
            user.credits_total = int(new_total)
            db.add(
                CreditTransaction(
                    user_id=int(user.id),
                    kind="admin_adjust",
                    amount=int(delta),
                    note=reason or f"admin_{mode}",
                )
            )
            db.add(user)
            _log_admin_event(
                db,
                "ADMIN_CREDITS_CHANGED",
                {
                    "admin_id": int(getattr(g, "current_user_id", 0) or 0),
                    "user_id": int(user.id),
                    "mode": mode,
                    "amount": int(amount),
                    "delta": int(delta),
                    "reason": reason,
                    "credits_total_before": int(current_total),
                    "credits_total_after": int(new_total),
                    "credits_used": int(used),
                },
            )
            db.commit()
        credits_available = get_available(user)
        return jsonify(
            {
                "ok": True,
                "credits_total": int(user.credits_total or 0),
                "credits_used": int(used),
                "credits_available": int(credits_available),
            }
        )
    except ValueError:
        db.rollback()
        return _error("invalid_input", 400)
    except Exception:
        db.rollback()
        current_app.logger.exception("admin_adjust_credits_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_admin.post("/users/<int:user_id>/ban")
@require_admin
def ban_user(user_id: int):
    data = request.get_json(silent=True) or {}
    if "banned" not in data:
        return _error("invalid_input", 400)
    banned_value = _parse_bool(data.get("banned"))
    reason = (data.get("reason") or "").strip() or None

    db = get_session()
    try:
        user = db.query(User).get(int(user_id))
        if not user:
            return _error("user_not_found", 404)
        user.is_banned = bool(banned_value)
        db.add(user)
        _log_admin_event(
            db,
            "ADMIN_USER_BANNED" if banned_value else "ADMIN_USER_UNBANNED",
            {
                "admin_id": int(getattr(g, "current_user_id", 0) or 0),
                "user_id": int(user.id),
                "banned": bool(banned_value),
                "reason": reason,
            },
        )
        db.commit()
        return jsonify({"ok": True, "banned": bool(user.is_banned)})
    except Exception:
        db.rollback()
        current_app.logger.exception("admin_ban_user_error")
        return _error("server_error", 500)
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


VALID_ROLES = {"user", "moderator", "admin"}


@bp_admin.post("/users/<int:user_id>/set_role")
@require_admin
def set_role(user_id: int):
    data = request.get_json(silent=True) or {}
    new_role = (data.get("role") or "").strip().lower()
    if new_role not in VALID_ROLES:
        return _error("invalid_input", 400)

    acting_admin_id = int(getattr(g, "current_user_id", 0) or 0)

    # Self-demotion guard
    if acting_admin_id == int(user_id) and new_role != "admin":
        return _error("cannot_demote_self", 403)

    db = get_session()
    try:
        u = db.query(User).with_for_update().get(int(user_id))
        if not u:
            return _error("user_not_found", 404)

        old_role = u.role or "user"

        # Last-admin guard: if demoting from admin, ensure at least one other admin remains
        if old_role == "admin" and new_role != "admin":
            admin_count = (
                db.query(func.count(User.id))
                .filter(User.role == "admin")
                .scalar()
                or 0
            )
            if int(admin_count) <= 1:
                return _error("last_admin_protected", 403)

        u.role = new_role
        db.add(u)
        _log_admin_event(
            db,
            "ADMIN_ROLE_CHANGED",
            {
                "admin_id": acting_admin_id,
                "target_user_id": int(u.id),
                "target_email": u.email,
                "old_role": old_role,
                "new_role": new_role,
            },
        )
        db.commit()
        return jsonify({"ok": True, "role": u.role})
    except Exception:
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


@bp_admin.get("/analyses")
@require_admin
def list_analyses():
    limit = _parse_int(request.args.get("limit"), 50)
    offset = _parse_int(request.args.get("offset"), 0)
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    user_id = (request.args.get("user_id") or "").strip()
    search = (request.args.get("search") or "").strip()
    status = (request.args.get("status") or "").strip().lower()
    media_type = (request.args.get("type") or request.args.get("media_type") or "").strip().lower()
    score_min_raw = (request.args.get("score_min") or "").strip()
    score_max_raw = (request.args.get("score_max") or "").strip()
    date_from_raw = (request.args.get("from") or request.args.get("date_from") or "").strip()
    date_to_raw = (request.args.get("to") or request.args.get("date_to") or "").strip()
    engine = (request.args.get("engine") or "").strip()
    score_min = None
    score_max = None
    date_from = _parse_date_str(date_from_raw)
    date_to = _parse_date_str(date_to_raw)
    if date_from_raw and not date_from:
        return _error("invalid_input", 400)
    if date_to_raw and not date_to:
        return _error("invalid_input", 400)
    if score_min_raw:
        try:
            score_min = float(score_min_raw)
        except Exception:
            return _error("invalid_input", 400)
    if score_max_raw:
        try:
            score_max = float(score_max_raw)
        except Exception:
            return _error("invalid_input", 400)

    db = get_session()
    try:
        query = db.query(AnalysisHistory)
        if user_id:
            try:
                query = query.filter(AnalysisHistory.user_id == int(user_id))
            except Exception:
                return _error("invalid_input", 400)
        if status:
            query = query.filter(AnalysisHistory.status == status)
        if media_type:
            query = query.filter(AnalysisHistory.media_type == media_type)
        if score_min is not None:
            query = query.filter(AnalysisHistory.final_score >= score_min)
        if score_max is not None:
            query = query.filter(AnalysisHistory.final_score <= score_max)
        if date_from:
            query = query.filter(func.date(AnalysisHistory.created_at) >= date_from)
        if date_to:
            query = query.filter(func.date(AnalysisHistory.created_at) <= date_to)
        if engine:
            query = query.filter(AnalysisHistory.engine_breakdown.ilike(f"%{engine}%"))
        if search:
            query = query.filter(or_(
                AnalysisHistory.title.ilike(f"%{search}%"),
                AnalysisHistory.id.ilike(f"%{search}%"),
            ))
        rows = (
            query.order_by(desc(AnalysisHistory.created_at))
            .limit(limit + 1)
            .offset(offset)
            .all()
        )
        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]
        items = []
        for row in rows:
            score = None
            if isinstance(row.final_score, (int, float)):
                score = int(round(float(row.final_score)))
            items.append(
                {
                    "id": row.id,
                    "user_id": int(row.user_id),
                    "created_at": _iso(row.created_at),
                    "media_type": row.media_type,
                    "status": row.status,
                    "final_score": score,
                    "verdict_label": row.verdict_label,
                    "credits_charged": int(row.credits_charged or 0),
                    "engines_summary": _engine_summary(row.engine_breakdown),
                }
            )
        return jsonify(
            {"ok": True, "items": items, "limit": limit, "offset": offset, "has_more": has_more}
        )
    finally:
        db.close()


@bp_admin.get("/analyses/<analysis_id>")
@require_admin
def get_analysis(analysis_id: str):
    db = get_session()
    try:
        row = db.query(AnalysisHistory).filter(AnalysisHistory.id == analysis_id).first()
        if not row:
            return _error("analysis_not_found", 404)
        score = None
        if isinstance(row.final_score, (int, float)):
            score = int(round(float(row.final_score)))
        engine_payload = _safe_json_load(row.engine_breakdown)
        engine_truncated = False
        if engine_payload is None:
            engine_payload, engine_truncated = _truncate_text(row.engine_breakdown, 6000)
        result_payload = _safe_json_load(row.result_payload)
        result_truncated = False
        if result_payload is None:
            result_payload, result_truncated = _truncate_text(row.result_payload, 6000)
        payload = {
            "id": row.id,
            "user_id": int(row.user_id),
            "created_at": _iso(row.created_at),
            "updated_at": _iso(row.updated_at),
            "media_type": row.media_type,
            "status": row.status,
            "final_score": score,
            "verdict_label": row.verdict_label,
            "credits_charged": int(row.credits_charged or 0),
            "engine_breakdown": engine_payload,
            "engine_breakdown_truncated": bool(engine_truncated),
            "result_payload": result_payload,
            "result_payload_truncated": bool(result_truncated),
        }
        return jsonify({"ok": True, "item": payload})
    finally:
        db.close()


@bp_admin.get("/logs")
@require_admin
def list_logs():
    limit = _parse_int(request.args.get("limit"), 100)
    offset = _parse_int(request.args.get("offset"), 0)
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    level = (request.args.get("level") or "").strip().lower()
    event = (request.args.get("event") or "").strip()
    q = (request.args.get("q") or "").strip()
    date_from_raw = (request.args.get("from") or request.args.get("date_from") or "").strip()
    date_to_raw = (request.args.get("to") or request.args.get("date_to") or "").strip()
    date_from = _parse_date_str(date_from_raw)
    date_to = _parse_date_str(date_to_raw)
    if date_from_raw and not date_from:
        return _error("invalid_input", 400)
    if date_to_raw and not date_to:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        query = db.query(AdminLog)
        if level:
            query = query.filter(AdminLog.level == level)
        if event:
            query = query.filter(AdminLog.event.ilike(f"%{event}%"))
        if q:
            query = query.filter(
                or_(
                    AdminLog.event.ilike(f"%{q}%"),
                    cast(AdminLog.meta_json, String).ilike(f"%{q}%"),
                )
            )
        if date_from:
            query = query.filter(func.date(AdminLog.ts) >= date_from)
        if date_to:
            query = query.filter(func.date(AdminLog.ts) <= date_to)
        rows = (
            query.order_by(desc(AdminLog.ts))
            .limit(limit + 1)
            .offset(offset)
            .all()
        )
        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]
        items = [
            {
                "id": row.id,
                "ts": _iso(row.ts),
                "level": row.level,
                "event": row.event,
                "meta": row.meta_json,
            }
            for row in rows
        ]
        return jsonify(
            {"ok": True, "items": items, "limit": limit, "offset": offset, "has_more": has_more}
        )
    finally:
        db.close()


@bp_admin.get("/credits")
@require_admin
def list_credits():
    limit = _parse_int(request.args.get("limit"), 50)
    offset = _parse_int(request.args.get("offset"), 0)
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    user_id_raw = (request.args.get("user_id") or "").strip()
    kind = (request.args.get("kind") or "").strip().lower()
    q = (request.args.get("q") or "").strip().lower()
    date_from_raw = (request.args.get("from") or request.args.get("date_from") or "").strip()
    date_to_raw = (request.args.get("to") or request.args.get("date_to") or "").strip()
    date_from = _parse_date_str(date_from_raw)
    date_to = _parse_date_str(date_to_raw)
    if date_from_raw and not date_from:
        return _error("invalid_input", 400)
    if date_to_raw and not date_to:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        query = db.query(CreditTransaction, User.email).join(User, User.id == CreditTransaction.user_id)
        if user_id_raw:
            try:
                user_id_value = int(user_id_raw)
                query = query.filter(CreditTransaction.user_id == user_id_value)
            except Exception:
                return _error("invalid_input", 400)
        if kind:
            query = query.filter(CreditTransaction.kind == kind)
        if q:
            query = query.filter(
                or_(
                    User.email.ilike(f"%{q}%"),
                    CreditTransaction.note.ilike(f"%{q}%"),
                    CreditTransaction.analysis_id.ilike(f"%{q}%"),
                )
            )
        if date_from:
            query = query.filter(func.date(CreditTransaction.created_at) >= date_from)
        if date_to:
            query = query.filter(func.date(CreditTransaction.created_at) <= date_to)
        rows = (
            query.order_by(desc(CreditTransaction.created_at))
            .limit(limit + 1)
            .offset(offset)
            .all()
        )
        has_more = len(rows) > limit
        if has_more:
            rows = rows[:limit]
        items = [
            {
                "id": row.id,
                "user_id": int(row.user_id),
                "email": email,
                "kind": row.kind,
                "amount": int(row.amount or 0),
                "note": row.note,
                "analysis_id": row.analysis_id,
                "media_type": row.media_type,
                "created_at": _iso(row.created_at),
            }
            for row, email in rows
        ]

        today = dt.datetime.utcnow().date().isoformat()
        summary = {
            "transactions_total": int(db.query(func.count(CreditTransaction.id)).scalar() or 0),
            "transactions_today": int(
                db.query(func.count(CreditTransaction.id))
                .filter(func.date(CreditTransaction.created_at) == today)
                .scalar()
                or 0
            ),
            "credits_spent_total": int(
                db.query(func.coalesce(func.sum(func.abs(CreditTransaction.amount)), 0))
                .filter(CreditTransaction.kind == "charge")
                .scalar()
                or 0
            ),
            "credits_spent_today": int(
                db.query(func.coalesce(func.sum(func.abs(CreditTransaction.amount)), 0))
                .filter(
                    CreditTransaction.kind == "charge",
                    func.date(CreditTransaction.created_at) == today,
                )
                .scalar()
                or 0
            ),
            "admin_adjust_total": int(
                db.query(func.coalesce(func.sum(CreditTransaction.amount), 0))
                .filter(CreditTransaction.kind == "admin_adjust")
                .scalar()
                or 0
            ),
            "admin_adjust_today": int(
                db.query(func.coalesce(func.sum(CreditTransaction.amount), 0))
                .filter(
                    CreditTransaction.kind == "admin_adjust",
                    func.date(CreditTransaction.created_at) == today,
                )
                .scalar()
                or 0
            ),
            "grants_total": int(
                db.query(func.coalesce(func.sum(CreditTransaction.amount), 0))
                .filter(CreditTransaction.kind == "grant")
                .scalar()
                or 0
            ),
            "grants_today": int(
                db.query(func.coalesce(func.sum(CreditTransaction.amount), 0))
                .filter(
                    CreditTransaction.kind == "grant",
                    func.date(CreditTransaction.created_at) == today,
                )
                .scalar()
                or 0
            ),
        }
        return jsonify(
            {
                "ok": True,
                "items": items,
                "limit": limit,
                "offset": offset,
                "has_more": has_more,
                "summary": summary,
            }
        )
    finally:
        db.close()


@bp_admin.get("/engines")
@require_admin
def list_engines():
    window = _parse_int(request.args.get("window"), 400)
    window = min(max(window, 50), 2000)
    recent_hours = _parse_int(request.args.get("recent_hours"), 24)
    recent_hours = min(max(recent_hours, 1), 168)
    db = get_session()
    try:
        active = set(_active_engines())
        usage = {}
        recent_cutoff = dt.datetime.utcnow() - dt.timedelta(hours=recent_hours)
        rows = (
            db.query(AnalysisHistory.engine_breakdown, AnalysisHistory.created_at)
            .order_by(desc(AnalysisHistory.created_at))
            .limit(window)
            .all()
        )
        for breakdown, created_at in rows:
            engines = _engine_names(breakdown)
            if not engines:
                continue
            created_cmp = created_at
            if created_at and getattr(created_at, "tzinfo", None) is not None:
                created_cmp = created_at.replace(tzinfo=None)
            for name in engines:
                entry = usage.setdefault(
                    name,
                    {"count": 0, "count_recent": 0, "last_used": None, "last_used_cmp": None},
                )
                entry["count"] += 1
                if created_cmp and (entry["last_used_cmp"] is None or created_cmp > entry["last_used_cmp"]):
                    entry["last_used"] = created_at
                    entry["last_used_cmp"] = created_cmp
                if created_cmp and created_cmp >= recent_cutoff:
                    entry["count_recent"] += 1

        names = sorted(set(list(active) + list(usage.keys())))
        items = []
        for name in names:
            info = usage.get(name, {})
            items.append(
                {
                    "name": name,
                    "status": "active" if name in active else "inactive",
                    "last_used": _iso(info.get("last_used")),
                    "calls_total": int(info.get("count") or 0),
                    "calls_recent": int(info.get("count_recent") or 0),
                }
            )
        return jsonify(
            {
                "ok": True,
                "items": items,
                "active": sorted(active),
                "window": int(window),
                "recent_hours": int(recent_hours),
            }
        )
    finally:
        db.close()


@bp_admin.get("/system")
@require_admin
def system_status():
    payload = {
        "environment": _environment_label(),
        "admin_enabled": _env_flag("AIREALCHECK_ALLOW_ADMIN", "false"),
        "database": {
            "engine": "sqlite" if using_sqlite() else "postgres",
            "using_sqlite": bool(using_sqlite()),
        },
        "email": email_debug_status(),
        "features": {
            "guest_analyze": _env_flag("AIREALCHECK_ENABLE_GUEST_ANALYZE", "false"),
            "paid_apis": _env_flag("AIREALCHECK_USE_PAID_APIS", "false"),
            "local_ml": _env_flag("AIREALCHECK_USE_LOCAL_ML", "true"),
            "image_fallback": _env_flag("AIREALCHECK_IMAGE_FALLBACK", "true"),
        },
    }
    return jsonify({"ok": True, "status": payload})


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
