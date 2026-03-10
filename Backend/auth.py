import os
import datetime as dt
import secrets
import html as html_lib
from urllib.parse import quote
from flask import Blueprint, request, jsonify, current_app, make_response, redirect

from authlib.integrations.flask_client import OAuth

from Backend.db import get_session
from Backend.models import (
    User,
    EmailVerifyToken,
    PasswordResetToken,
    RefreshToken,
    UserConsent,
    CreditTransaction,
)
from Backend.middleware import (
    create_password_hash,
    check_password,
    create_access_token,
    require_auth,
    _error,
    hash_token,
    rate_limit,
)
from Backend.runtime import is_production
from Backend.emailer import email_ready, send_email


bp_auth = Blueprint("auth", __name__, url_prefix="/auth")

FREE_CREDITS_DEFAULT = int(os.getenv("AIREALCHECK_FREE_CREDITS", "100") or 100)
VERIFY_TOKEN_HOURS = int(os.getenv("AIREALCHECK_VERIFY_TOKEN_HOURS", "48") or 48)
RESET_TOKEN_HOURS = int(os.getenv("AIREALCHECK_RESET_TOKEN_HOURS", "2") or 2)
REFRESH_TOKEN_DAYS = int(os.getenv("AIREALCHECK_REFRESH_TOKEN_DAYS", "30") or 30)
REFRESH_COOKIE_NAME = os.getenv("AIREALCHECK_REFRESH_COOKIE", "aireal_refresh")
COOKIE_SECURE = os.getenv("AIREALCHECK_COOKIE_SECURE", "false").lower() in {"1", "true", "yes"}
COOKIE_SAMESITE = (os.getenv("AIREALCHECK_COOKIE_SAMESITE") or "").strip()
if is_production():
    COOKIE_SECURE = True
    if not COOKIE_SAMESITE:
        COOKIE_SAMESITE = "None"
elif not COOKIE_SAMESITE:
    COOKIE_SAMESITE = "Lax"

GOOGLE_OAUTH_METADATA_URL = "https://accounts.google.com/.well-known/openid-configuration"
GOOGLE_OAUTH_SCOPES = "openid email profile"

TERMS_CONSENT_TYPE = "terms_privacy"

oauth = OAuth()


def _google_oauth_config():
    client_id = (os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_OAUTH_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("GOOGLE_CLIENT_SECRET") or os.getenv("GOOGLE_OAUTH_CLIENT_SECRET") or "").strip()
    redirect_uri = (os.getenv("GOOGLE_REDIRECT_URI") or os.getenv("GOOGLE_OAUTH_REDIRECT_URI") or "").strip()
    return client_id, client_secret, redirect_uri


@bp_auth.record_once
def _init_google_oauth(state):
    client_id, client_secret, _ = _google_oauth_config()
    if not state.app.secret_key:
        state.app.secret_key = (
            os.getenv("AIREALCHECK_SESSION_SECRET")
            or os.getenv("AIREALCHECK_JWT_SECRET", "dev_change_me")
        )
    oauth.init_app(state.app)
    if not client_id or not client_secret:
        return
    oauth.register(
        name="google",
        client_id=client_id,
        client_secret=client_secret,
        server_metadata_url=GOOGLE_OAUTH_METADATA_URL,
        client_kwargs={"scope": GOOGLE_OAUTH_SCOPES},
    )


def _google_client():
    return oauth.create_client("google")


def _client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr) or "?"


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _is_premium_user(u: User) -> bool:
    plan = (u.plan_type or "free").strip().lower()
    if plan == "free":
        return False
    return bool(u.subscription_active)


def _sanitize_user(u: User):
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "email_verified": bool(u.email_verified),
        "role": u.role,
        "is_admin": u.role == "admin",
        "is_banned": bool(getattr(u, "is_banned", False)),
        "is_premium": _is_premium_user(u),
        "plan_type": (u.plan_type or "free"),
        "subscription_active": bool(u.subscription_active),
        "credits_total": int(u.credits_total or 0),
        "credits_used": int(u.credits_used or 0),
        "last_credit_reset": (u.last_credit_reset.isoformat() + "Z") if u.last_credit_reset else None,
        "language": (getattr(u, "language", None) or "de"),
        "created_at": (u.created_at.isoformat() + "Z") if u.created_at else None,
        "updated_at": (u.updated_at.isoformat() + "Z") if u.updated_at else None,
    }


def _public_api_url():
    return (os.getenv("AIREALCHECK_PUBLIC_API_URL") or "http://localhost:5001").rstrip("/")


def _public_web_url():
    return (os.getenv("AIREALCHECK_PUBLIC_WEB_URL") or "http://127.0.0.1:5500").rstrip("/")


def _oauth_debug_enabled():
    return os.getenv("AIREALCHECK_DEBUG_OAUTH", "").strip().lower() in {"1", "true", "yes", "on"}


def _log_oauth_redirect(target_url: str, token_created: bool):
    if not _oauth_debug_enabled():
        return
    safe_target = (target_url or "").split("#", 1)[0]
    current_app.logger.info(
        "oauth_redirect target=%s token_created=%s",
        safe_target,
        "yes" if token_created else "no",
    )


def _build_oauth_callback_url(token: str) -> str:
    web = _public_web_url()
    token_value = quote(token or "", safe="")
    return f"{web}/auth/callback#token={token_value}"


def _build_oauth_error_url() -> str:
    web = _public_web_url()
    return f"{web}/login?oauth_error=1"


def _oauth_error_redirect():
    target = _build_oauth_error_url()
    _log_oauth_redirect(target, token_created=False)
    return redirect(target)


def _build_verify_link(token: str) -> str:
    web = _public_web_url()
    if web:
        return f"{web}/verify-email?token={token}"
    return f"{_public_api_url()}/auth/verify?token={token}"


def _build_reset_link(token: str) -> str:
    web = _public_web_url()
    if web:
        return f"{web}/reset-password?token={token}"
    return f"{_public_api_url()}/auth/reset?token={token}"


def _ensure_terms_consent(db, user_id: int):
    if not user_id:
        return
    exists = (
        db.query(UserConsent)
        .filter(UserConsent.user_id == user_id, UserConsent.consent_type == TERMS_CONSENT_TYPE)
        .first()
    )
    if exists:
        return
    db.add(
        UserConsent(
            user_id=user_id,
            consent_type=TERMS_CONSENT_TYPE,
            accepted_at=dt.datetime.utcnow(),
        )
    )


def _build_email_html(title: str, intro_lines, cta_label: str, cta_url: str, outro_lines):
    safe_title = html_lib.escape(title or "")
    safe_cta_label = html_lib.escape(cta_label or "Weiter")
    safe_cta_url = html_lib.escape(cta_url or "", quote=True)
    intro_html = "".join(f"<p>{html_lib.escape(line)}</p>" for line in intro_lines if line)
    outro_html = "".join(f"<p>{html_lib.escape(line)}</p>" for line in outro_lines if line)
    return f"""\
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{safe_title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f9fb;color:#0f172a;font-family:Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e3e7ef;padding:28px;">
            <tr>
              <td>
                <h2 style="margin:0 0 16px;font-size:22px;line-height:1.3;">{safe_title}</h2>
                {intro_html}
                <div style="margin:22px 0;">
                  <a href="{safe_cta_url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">
                    {safe_cta_label}
                  </a>
                </div>
                <p style="margin:0 0 8px;color:#475569;font-size:14px;">Falls der Button nicht funktioniert, nutze diesen Link:</p>
                <p style="margin:0 0 16px;word-break:break-all;font-size:14px;">
                  <a href="{safe_cta_url}" style="color:#2563eb;text-decoration:none;">{safe_cta_url}</a>
                </p>
                {outro_html}
                <p style="margin-top:18px;color:#94a3b8;font-size:12px;">AIRealCheck</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _set_refresh_cookie(resp, token: str):
    resp.set_cookie(
        REFRESH_COOKIE_NAME,
        token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=int(REFRESH_TOKEN_DAYS * 24 * 60 * 60),
        path="/auth",
    )


def _clear_refresh_cookie(resp):
    resp.set_cookie(
        REFRESH_COOKIE_NAME,
        "",
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=0,
        expires=0,
        path="/auth",
    )


@bp_auth.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    display_name = (data.get("display_name") or data.get("displayName") or data.get("name") or "").strip()
    password = data.get("password") or ""
    consent_terms = _parse_bool(data.get("consent_terms") or data.get("accept_terms"))
    if not email or not password or len(password) < 8 or "@" not in email or not display_name:
        return _error("invalid_input", 400)
    if len(display_name) > 120:
        return _error("invalid_input", 400)
    if not consent_terms:
        return _error("terms_not_accepted", 400)
    if not rate_limit(f"register:ip:{_client_ip()}", limit=5, window_sec=60):
        return _error("rate_limited", 429)
    if not rate_limit(f"register:email:{email}", limit=3, window_sec=3600):
        return _error("rate_limited", 429)
    subject = "AIRealCheck: Bitte E-Mail bestätigen"
    if not email_ready(email, subject, current_app.logger, template_name="verify_email"):
        return _error("smtp_not_configured", 500)

    db = get_session()
    try:
        exists = db.query(User).filter(User.email == email).first()
        if exists:
            return jsonify({"ok": False, "error": "email_exists"}), 400
        now = dt.datetime.now(dt.timezone.utc)
        user = User(
            email=email,
            display_name=display_name,
            password_hash=create_password_hash(password),
            role="user",
            email_verified=False,
            is_premium=False,
            plan_type="free",
            subscription_active=False,
            credits_total=int(FREE_CREDITS_DEFAULT),
            credits_used=0,
            last_credit_reset=now,
        )
        db.add(user)
        db.flush()
        if FREE_CREDITS_DEFAULT:
            db.add(
                CreditTransaction(
                    user_id=user.id,
                    kind="grant",
                    amount=int(FREE_CREDITS_DEFAULT),
                    note="signup_free_credits",
                )
            )
        token = secrets.token_urlsafe(32)
        token_row = EmailVerifyToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=dt.datetime.utcnow() + dt.timedelta(hours=VERIFY_TOKEN_HOURS),
        )
        db.add(token_row)
        _ensure_terms_consent(db, user.id)
        db.commit()
    except Exception as exc:
        db.rollback()
        current_app.logger.exception("register_error")
        return _error("server_error", 500)
    finally:
        db.close()

    verify_link = _build_verify_link(token)
    greeting = f"Hallo {display_name}," if display_name else "Hallo,"
    body = "\n".join(
        [
            greeting,
            "",
            "danke für deine Registrierung bei AIRealCheck.",
            "Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren:",
            verify_link,
            "",
            f"Der Link ist {VERIFY_TOKEN_HOURS} Stunden gültig.",
            "Falls du dich nicht registriert hast, ignoriere diese E-Mail.",
            "Sicherheitshinweis: Teile diesen Link nicht mit anderen.",
        ]
    )
    html_body = _build_email_html(
        "E-Mail bestätigen",
        [
            greeting,
            "Danke für deine Registrierung bei AIRealCheck.",
            "Bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren.",
        ],
        "E-Mail bestätigen",
        verify_link,
        [
            f"Der Link ist {VERIFY_TOKEN_HOURS} Stunden gültig.",
            "Falls du dich nicht registriert hast, ignoriere diese E-Mail.",
            "Sicherheitshinweis: Teile diesen Link nicht mit anderen.",
        ],
    )
    ok, err, reason = send_email(
        email,
        subject,
        body,
        logger=current_app.logger,
        template_name="verify_email",
        html_body=html_body,
    )
    if not ok:
        return _error(err or "email_send_failed", 500, [reason] if reason else [])
    return jsonify({"ok": True})


@bp_auth.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return _error("invalid_input", 400)
    if not rate_limit(f"login:ip:{_client_ip()}", limit=10, window_sec=60):
        return _error("rate_limited", 429)
    if not rate_limit(f"login:email:{email}", limit=10, window_sec=60):
        return _error("rate_limited", 429)

    db = get_session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not check_password(password, user.password_hash):
            return _error("invalid_credentials", 401)
        user.last_login = dt.datetime.utcnow()
        db.add(user)
        access_token = create_access_token(user)
        refresh_token = secrets.token_urlsafe(48)
        db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh_token),
                expires_at=dt.datetime.utcnow() + dt.timedelta(days=REFRESH_TOKEN_DAYS),
                user_agent=request.headers.get("User-Agent"),
                ip_address=_client_ip(),
            )
        )
        db.commit()
        resp = make_response(jsonify({"ok": True, "token": access_token, "user": _sanitize_user(user)}))
        _set_refresh_cookie(resp, refresh_token)
        return resp
    except Exception as exc:
        db.rollback()
        current_app.logger.exception("login_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.get("/google")
def google_login():
    client_id, client_secret, redirect_uri = _google_oauth_config()
    if not client_id or not client_secret or not redirect_uri:
        return _error("oauth_not_configured", 500)
    client = _google_client()
    if not client:
        return _error("oauth_not_configured", 500)
    return client.authorize_redirect(redirect_uri)


@bp_auth.get("/google/callback")
def google_callback():
    client_id, client_secret, _ = _google_oauth_config()
    if not client_id or not client_secret:
        current_app.logger.warning("google_oauth_not_configured")
        return _oauth_error_redirect()
    client = _google_client()
    if not client:
        current_app.logger.warning("google_oauth_client_missing")
        return _oauth_error_redirect()
    try:
        client.authorize_access_token()
    except Exception:
        current_app.logger.exception("google_oauth_token_error")
        return _oauth_error_redirect()
    try:
        resp = client.get("https://openidconnect.googleapis.com/v1/userinfo")
        userinfo = resp.json() if resp else {}
    except Exception:
        current_app.logger.exception("google_oauth_userinfo_error")
        return _oauth_error_redirect()
    email = (userinfo.get("email") or "").strip().lower()
    if not email or "@" not in email:
        current_app.logger.warning("google_oauth_missing_email")
        return _oauth_error_redirect()
    display_name = (userinfo.get("name") or userinfo.get("given_name") or "").strip()
    if not display_name:
        display_name = email.split("@", 1)[0]
    if len(display_name) > 120:
        display_name = display_name[:120]

    db = get_session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            now = dt.datetime.now(dt.timezone.utc)
            user = User(
                email=email,
                display_name=display_name,
                password_hash=create_password_hash(secrets.token_urlsafe(32)),
                role="user",
                email_verified=True,
                is_premium=False,
                plan_type="free",
                subscription_active=False,
                credits_total=int(FREE_CREDITS_DEFAULT),
                credits_used=0,
                last_credit_reset=now,
                last_login=now,
            )
            db.add(user)
            db.flush()
            if FREE_CREDITS_DEFAULT:
                db.add(
                    CreditTransaction(
                        user_id=user.id,
                        kind="grant",
                        amount=int(FREE_CREDITS_DEFAULT),
                        note="signup_free_credits",
                    )
                )
        else:
            user.last_login = dt.datetime.utcnow()
            db.add(user)
            if not user.email_verified:
                user.email_verified = True
                db.add(user)
            if display_name and not user.display_name:
                user.display_name = display_name
                db.add(user)
        _ensure_terms_consent(db, user.id)
        access_token = create_access_token(user)
        refresh_token = secrets.token_urlsafe(48)
        db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(refresh_token),
                expires_at=dt.datetime.utcnow() + dt.timedelta(days=REFRESH_TOKEN_DAYS),
                user_agent=request.headers.get("User-Agent"),
                ip_address=_client_ip(),
            )
        )
        db.commit()
        redirect_url = _build_oauth_callback_url(access_token)
        resp = redirect(redirect_url)
        _set_refresh_cookie(resp, refresh_token)
        _log_oauth_redirect(redirect_url, token_created=True)
        return resp
    except Exception:
        db.rollback()
        current_app.logger.exception("google_oauth_login_error")
        return _oauth_error_redirect()
    finally:
        db.close()


@bp_auth.get("/me")
@require_auth
def me():
    from flask import g

    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        return jsonify({"ok": True, "user": _sanitize_user(user)})
    finally:
        db.close()


@bp_auth.route("/verify", methods=["GET", "POST"])
def verify_email():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or request.args.get("token") or "").strip()
    if not token:
        return _error("invalid_token", 400)
    token_hash = hash_token(token)
    now = dt.datetime.utcnow()

    db = get_session()
    try:
        row = db.query(EmailVerifyToken).filter(EmailVerifyToken.token_hash == token_hash).first()
        if not row or row.used_at or row.expires_at < now:
            return _error("invalid_token", 400)
        user = db.query(User).get(int(row.user_id))
        if not user:
            return _error("user_not_found", 404)
        user.email_verified = True
        row.used_at = now
        db.add(user)
        db.add(row)
        db.commit()
        return jsonify({"ok": True})
    except Exception as exc:
        db.rollback()
        current_app.logger.exception("verify_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.post("/resend-verify")
@require_auth
def resend_verify():
    from flask import g

    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        if user.email_verified:
            return jsonify({"ok": True, "already_verified": True})
        subject = "AIRealCheck: Bitte E-Mail bestätigen"
        if not email_ready(user.email, subject, current_app.logger, template_name="verify_email_resend"):
            return _error("smtp_not_configured", 500)
        if not rate_limit(f"resend_verify:{user.id}", limit=3, window_sec=3600):
            return _error("rate_limited", 429)
        token = secrets.token_urlsafe(32)
        row = EmailVerifyToken(
            user_id=user.id,
            token_hash=hash_token(token),
            expires_at=dt.datetime.utcnow() + dt.timedelta(hours=VERIFY_TOKEN_HOURS),
        )
        db.add(row)
        db.commit()
        user_email = user.email
        user_display_name = user.display_name
    except Exception as exc:
        db.rollback()
        current_app.logger.exception("resend_verify_error")
        return _error("server_error", 500)
    finally:
        db.close()

    verify_link = _build_verify_link(token)
    greeting = f"Hallo {user_display_name}," if user_display_name else "Hallo,"
    body = "\n".join(
        [
            greeting,
            "",
            "hier ist dein neuer Bestätigungslink für AIRealCheck:",
            verify_link,
            "",
            f"Der Link ist {VERIFY_TOKEN_HOURS} Stunden gültig.",
            "Falls du dich nicht registriert hast, ignoriere diese E-Mail.",
            "Sicherheitshinweis: Teile diesen Link nicht mit anderen.",
        ]
    )
    html_body = _build_email_html(
        "E-Mail bestätigen",
        [
            greeting,
            "Hier ist dein neuer Bestätigungslink für AIRealCheck.",
        ],
        "E-Mail bestätigen",
        verify_link,
        [
            f"Der Link ist {VERIFY_TOKEN_HOURS} Stunden gültig.",
            "Falls du dich nicht registriert hast, ignoriere diese E-Mail.",
            "Sicherheitshinweis: Teile diesen Link nicht mit anderen.",
        ],
    )
    ok, err, reason = send_email(
        user_email,
        subject,
        body,
        logger=current_app.logger,
        template_name="verify_email_resend",
        html_body=html_body,
    )
    if not ok:
        return _error(err or "email_send_failed", 500, [reason] if reason else [])
    return jsonify({"ok": True})


@bp_auth.post("/forgot")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return _error("invalid_input", 400)
    if not rate_limit(f"forgot:ip:{_client_ip()}", limit=5, window_sec=60):
        return _error("rate_limited", 429)
    if not rate_limit(f"forgot:email:{email}", limit=5, window_sec=3600):
        return _error("rate_limited", 429)
    subject = "AIRealCheck: Passwort zurücksetzen"
    if not email_ready(email, subject, current_app.logger, template_name="password_reset"):
        return _error("smtp_not_configured", 500)

    db = get_session()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            token = secrets.token_urlsafe(32)
            row = PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=dt.datetime.utcnow() + dt.timedelta(hours=RESET_TOKEN_HOURS),
            )
            db.add(row)
            db.commit()
            reset_link = _build_reset_link(token)
            greeting = f"Hallo {user.display_name}," if user.display_name else "Hallo,"
            body = "\n".join(
                [
                    greeting,
                    "",
                    "du hast eine Passwort-Zurücksetzung angefordert.",
                    "Nutze den Link, um ein neues Passwort zu setzen:",
                    reset_link,
                    "",
                    f"Der Link ist {RESET_TOKEN_HOURS} Stunden gültig.",
                    "Falls du das nicht angefordert hast, ignoriere diese E-Mail.",
                    "Sicherheitshinweis: Teile diesen Link nicht mit anderen.",
                ]
            )
            html_body = _build_email_html(
                "Passwort zurücksetzen",
                [
                    greeting,
                    "Du hast eine Passwort-Zurücksetzung angefordert.",
                    "Nutze den Link, um ein neues Passwort zu setzen.",
                ],
                "Passwort zurücksetzen",
                reset_link,
                [
                    f"Der Link ist {RESET_TOKEN_HOURS} Stunden gültig.",
                    "Falls du das nicht angefordert hast, ignoriere diese E-Mail.",
                    "Sicherheitshinweis: Teile diesen Link nicht mit anderen.",
                ],
            )
            ok, err, reason = send_email(
                email,
                subject,
                body,
                logger=current_app.logger,
                template_name="password_reset",
                html_body=html_body,
            )
            if not ok:
                return _error(err or "email_send_failed", 500, [reason] if reason else [])
        else:
            db.commit()
    except Exception as exc:
        db.rollback()
        current_app.logger.exception("forgot_error")
        return _error("server_error", 500)
    finally:
        db.close()
    return jsonify({"ok": True})


@bp_auth.post("/reset")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or request.args.get("token") or "").strip()
    new_password = data.get("password") or ""
    if not token or not new_password or len(new_password) < 8:
        return _error("invalid_input", 400)
    token_hash = hash_token(token)
    now = dt.datetime.utcnow()

    db = get_session()
    try:
        row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
        if not row or row.used_at or row.expires_at < now:
            return _error("invalid_token", 400)
        user = db.query(User).get(int(row.user_id))
        if not user:
            return _error("user_not_found", 404)
        user.password_hash = create_password_hash(new_password)
        row.used_at = now
        db.add(user)
        db.add(row)
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        ).update({RefreshToken.revoked_at: now})
        db.commit()
        return jsonify({"ok": True})
    except Exception as exc:
        db.rollback()
        current_app.logger.exception("reset_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.get("/reset/validate")
def reset_validate():
    token = (request.args.get("token") or "").strip()
    if not token:
        return _error("invalid_token", 400)
    token_hash = hash_token(token)
    now = dt.datetime.utcnow()

    db = get_session()
    try:
        row = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
        if not row:
            return jsonify({"ok": True, "valid": False, "reason": "not_found"})
        if row.used_at:
            return jsonify({"ok": True, "valid": False, "reason": "used"})
        if row.expires_at < now:
            return jsonify({"ok": True, "valid": False, "reason": "expired"})
        user = db.query(User).get(int(row.user_id))
        if not user:
            return jsonify({"ok": True, "valid": False, "reason": "user_not_found"})
        return jsonify({"ok": True, "valid": True})
    except Exception:
        current_app.logger.exception("reset_validate_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.post("/refresh")
def refresh():
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        return _error("auth_required", 401)
    token_hash = hash_token(refresh_token)
    now = dt.datetime.utcnow()

    db = get_session()
    try:
        row = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
        if not row or row.revoked_at or row.expires_at < now:
            return _error("invalid_token", 401)
        user = db.query(User).get(int(row.user_id))
        if not user:
            return _error("user_not_found", 404)
        row.revoked_at = now
        new_refresh = secrets.token_urlsafe(48)
        db.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_token(new_refresh),
                expires_at=now + dt.timedelta(days=REFRESH_TOKEN_DAYS),
                user_agent=request.headers.get("User-Agent"),
                ip_address=_client_ip(),
            )
        )
        access_token = create_access_token(user)
        db.add(row)
        db.commit()
        resp = make_response(jsonify({"ok": True, "token": access_token, "user": _sanitize_user(user)}))
        _set_refresh_cookie(resp, new_refresh)
        return resp
    except Exception as exc:
        db.rollback()
        current_app.logger.exception("refresh_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.patch("/profile")
@require_auth
def update_profile():
    from flask import g

    data = request.get_json(silent=True) or {}
    display_name = (data.get("display_name") or "").strip()
    if not display_name or len(display_name) > 120:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        user.display_name = display_name
        db.add(user)
        db.commit()
        return jsonify({"ok": True, "user": _sanitize_user(user)})
    except Exception:
        db.rollback()
        current_app.logger.exception("update_profile_error")
        return _error("server_error", 500)
    finally:
        db.close()


SUPPORTED_LANGUAGES = {"de", "en", "fr", "es"}


@bp_auth.patch("/language")
@require_auth
def update_language():
    from flask import g

    data = request.get_json(silent=True) or {}
    lang = (data.get("language") or "").strip().lower()
    if lang not in SUPPORTED_LANGUAGES:
        return _error("invalid_input", 400)

    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        user.language = lang
        db.add(user)
        db.commit()
        return jsonify({"ok": True, "language": lang})
    except Exception:
        db.rollback()
        current_app.logger.exception("update_language_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.patch("/change-password")
@require_auth
def change_password():
    from flask import g

    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    if not current_password or not new_password or len(new_password) < 8:
        return _error("invalid_input", 400)
    if not rate_limit(f"change_password:{g.current_user_id}", limit=5, window_sec=300):
        return _error("rate_limited", 429)

    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        if not check_password(current_password, user.password_hash):
            return _error("invalid_credentials", 401)
        user.password_hash = create_password_hash(new_password)
        db.add(user)
        db.commit()
        return jsonify({"ok": True})
    except Exception:
        db.rollback()
        current_app.logger.exception("change_password_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.delete("/account")
@require_auth
def delete_account():
    from flask import g

    data = request.get_json(silent=True) or {}
    password = data.get("password") or ""
    if not password:
        return _error("invalid_input", 400)
    if not rate_limit(f"delete_account:{g.current_user_id}", limit=3, window_sec=3600):
        return _error("rate_limited", 429)

    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        if not check_password(password, user.password_hash):
            return _error("invalid_credentials", 401)
        # Soft-delete: anonymize personal data and block access
        now = dt.datetime.utcnow()
        user.email = f"deleted_{user.id}@deleted.local"
        user.display_name = "[gelöscht]"
        user.password_hash = create_password_hash(secrets.token_urlsafe(32))
        user.email_verified = False
        user.is_banned = True
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)
        ).update({RefreshToken.revoked_at: now})
        db.add(user)
        db.commit()
        resp = make_response(jsonify({"ok": True}))
        _clear_refresh_cookie(resp)
        return resp
    except Exception:
        db.rollback()
        current_app.logger.exception("delete_account_error")
        return _error("server_error", 500)
    finally:
        db.close()


@bp_auth.post("/logout")
def logout():
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token:
        token_hash = hash_token(refresh_token)
        db = get_session()
        try:
            row = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
            if row and not row.revoked_at:
                row.revoked_at = dt.datetime.utcnow()
                db.add(row)
                db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    resp = make_response(jsonify({"ok": True}))
    _clear_refresh_cookie(resp)
    return resp
