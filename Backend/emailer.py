import os
import smtplib
import logging
from email.message import EmailMessage


_DEFAULT_SMTP_PORT = 587


def _env_flag(name: str, default: str = "false") -> bool:
    return (os.getenv(name, default) or "").strip().lower() in {"1", "true", "yes"}


def _smtp_port():
    raw = (os.getenv("SMTP_PORT") or "").strip()
    if not raw:
        return _DEFAULT_SMTP_PORT
    try:
        return int(raw)
    except Exception:
        return None


def _smtp_config():
    host = (os.getenv("SMTP_HOST") or "").strip()
    user = (os.getenv("SMTP_USER") or "").strip()
    password = os.getenv("SMTP_PASS") or ""
    use_tls = _env_flag("SMTP_USE_TLS", "true")
    use_ssl = _env_flag("SMTP_USE_SSL", "false")
    from_addr = (os.getenv("SMTP_FROM") or "").strip() or user or "no-reply@airealcheck.local"
    port = _smtp_port()
    host_set = bool(host)
    from_set = bool((os.getenv("SMTP_FROM") or "").strip() or user)
    auth_set = bool(user and password)
    configured = bool(host and port)
    dev_console = _env_flag("AIREALCHECK_EMAIL_DEV_CONSOLE", "false")
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
        "from_addr": from_addr,
        "host_set": host_set,
        "from_set": from_set,
        "auth_set": auth_set,
        "configured": configured,
        "dev_console": dev_console,
    }


def smtp_configured() -> bool:
    return _smtp_config().get("configured", False)


def email_dev_console_enabled() -> bool:
    return _env_flag("AIREALCHECK_EMAIL_DEV_CONSOLE", "false")


def _smtp_provider(cfg) -> str:
    if cfg.get("dev_console"):
        return "dev_console"
    if cfg.get("host_set"):
        return "smtp"
    return "none"


def _env_status(cfg):
    return {
        "env_complete": bool(cfg.get("configured")),
        "host_set": bool(cfg.get("host_set")),
        "from_set": bool(cfg.get("from_set")),
        "port": cfg.get("port"),
        "auth_set": bool(cfg.get("auth_set")),
        "use_tls": bool(cfg.get("use_tls")),
        "use_ssl": bool(cfg.get("use_ssl")),
        "dev_console": bool(cfg.get("dev_console")),
    }


def email_ready(to_email: str, subject: str, logger=None, template_name: str = None) -> bool:
    cfg = _smtp_config()
    if cfg.get("configured") or cfg.get("dev_console"):
        return True
    provider = _smtp_provider(cfg)
    env_status = _env_status(cfg)
    _log_failed(
        logger,
        to_email,
        subject,
        "smtp_not_configured",
        template_name=template_name,
        provider=provider,
        env_ok=env_status.get("env_complete"),
    )
    return False


def _log_attempt(logger, to_email: str, subject: str, template_name: str, provider: str, env_status: dict):
    logger = logger or logging.getLogger("emailer")
    logger.info(
        "EMAIL_SEND_ATTEMPT to=%s subject=%s template=%s provider=%s env_complete=%s host_set=%s from_set=%s port=%s auth_set=%s tls=%s ssl=%s dev_console=%s",
        to_email,
        subject,
        template_name or "-",
        provider,
        env_status.get("env_complete"),
        env_status.get("host_set"),
        env_status.get("from_set"),
        env_status.get("port"),
        env_status.get("auth_set"),
        env_status.get("use_tls"),
        env_status.get("use_ssl"),
        env_status.get("dev_console"),
    )


def _log_ok(
    logger,
    to_email: str,
    subject: str,
    reason: str,
    template_name: str = None,
    provider: str = None,
    env_ok=None,
    smtp_code=None,
    smtp_message=None,
):
    logger = logger or logging.getLogger("emailer")
    logger.info(
        "EMAIL_SEND_OK reason=%s to=%s subject=%s template=%s provider=%s env_complete=%s smtp_code=%s smtp_message=%s",
        reason,
        to_email,
        subject,
        template_name or "-",
        provider or "-",
        env_ok,
        smtp_code,
        smtp_message,
    )


def _log_failed(
    logger,
    to_email: str,
    subject: str,
    reason: str,
    template_name: str = None,
    provider: str = None,
    env_ok=None,
    smtp_code=None,
    smtp_message=None,
):
    logger = logger or logging.getLogger("emailer")
    logger.warning(
        "EMAIL_SEND_FAILED reason=%s to=%s subject=%s template=%s provider=%s env_complete=%s smtp_code=%s smtp_message=%s",
        reason,
        to_email,
        subject,
        template_name or "-",
        provider or "-",
        env_ok,
        smtp_code,
        smtp_message,
    )


def _emit_dev_console(to_email: str, subject: str, body: str):
    print("----- DEV EMAIL -----")
    print(f"To: {to_email}")
    print(f"Subject: {subject}")
    print("Body:")
    print(body)
    print("----- END DEV EMAIL -----")


def _format_smtp_message(message):
    if message is None:
        return None
    if isinstance(message, bytes):
        return message.decode("utf-8", errors="replace")
    return str(message)


def _smtp_error_details(exc):
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        recipients = getattr(exc, "recipients", None) or {}
        if recipients:
            code, message = next(iter(recipients.values()))
            return code, _format_smtp_message(message)
    if isinstance(exc, smtplib.SMTPResponseException):
        return exc.smtp_code, _format_smtp_message(exc.smtp_error)
    return None, None


def send_email(to_email: str, subject: str, body: str, logger=None, template_name: str = None, html_body: str = None):
    cfg = _smtp_config()
    provider = _smtp_provider(cfg)
    env_status = _env_status(cfg)
    _log_attempt(logger, to_email, subject, template_name, provider, env_status)
    if not cfg.get("configured"):
        if cfg.get("dev_console"):
            _emit_dev_console(to_email, subject, body)
            _log_ok(
                logger,
                to_email,
                subject,
                "dev_console",
                template_name=template_name,
                provider=provider,
                env_ok=env_status.get("env_complete"),
            )
            return True, None, "dev_console"
        _log_failed(
            logger,
            to_email,
            subject,
            "smtp_not_configured",
            template_name=template_name,
            provider=provider,
            env_ok=env_status.get("env_complete"),
        )
        return False, "smtp_not_configured", "smtp_not_configured"
    if not cfg.get("port"):
        _log_failed(
            logger,
            to_email,
            subject,
            "smtp_port_invalid",
            template_name=template_name,
            provider=provider,
            env_ok=env_status.get("env_complete"),
        )
        return False, "smtp_not_configured", "smtp_port_invalid"

    msg = EmailMessage()
    msg["From"] = cfg["from_addr"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body or "", charset="utf-8")
    if html_body:
        msg.add_alternative(html_body, subtype="html", charset="utf-8")

    try:
        if cfg["use_ssl"]:
            server = smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=10)
        else:
            server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=10)
        with server:
            if cfg["use_tls"] and not cfg["use_ssl"]:
                server.starttls()
            if cfg["user"] and cfg["password"]:
                server.login(cfg["user"], cfg["password"])
            refused = server.send_message(msg)
            if refused:
                code, message = next(iter(refused.values()))
                _log_failed(
                    logger,
                    to_email,
                    subject,
                    "smtp_recipient_refused",
                    template_name=template_name,
                    provider=provider,
                    env_ok=env_status.get("env_complete"),
                    smtp_code=code,
                    smtp_message=_format_smtp_message(message),
                )
                return False, "email_send_failed", f"smtp_recipient_refused:{code}"
            smtp_code = None
            smtp_message = None
            try:
                smtp_code, smtp_message = server.noop()
            except Exception:
                smtp_code = None
                smtp_message = None
        _log_ok(
            logger,
            to_email,
            subject,
            "smtp",
            template_name=template_name,
            provider=provider,
            env_ok=env_status.get("env_complete"),
            smtp_code=smtp_code,
            smtp_message=_format_smtp_message(smtp_message),
        )
        return True, None, "smtp"
    except Exception as exc:
        reason = f"smtp_exception:{type(exc).__name__}"
        smtp_code, smtp_message = _smtp_error_details(exc)
        log = logger or logging.getLogger("emailer")
        log.exception(
            "EMAIL_SEND_EXCEPTION to=%s subject=%s template=%s provider=%s",
            to_email,
            subject,
            template_name or "-",
            provider,
        )
        _log_failed(
            logger,
            to_email,
            subject,
            reason,
            template_name=template_name,
            provider=provider,
            env_ok=env_status.get("env_complete"),
            smtp_code=smtp_code,
            smtp_message=smtp_message,
        )
        return False, "email_send_failed", reason


def email_debug_status():
    cfg = _smtp_config()
    return {
        "smtp_configured": bool(cfg.get("configured")),
        "dev_console": bool(cfg.get("dev_console")),
        "from_set": bool(cfg.get("from_set")),
        "host_set": bool(cfg.get("host_set")),
        "port": cfg.get("port"),
        "auth_set": bool(cfg.get("auth_set")),
        "use_tls": bool(cfg.get("use_tls")),
        "use_ssl": bool(cfg.get("use_ssl")),
        "provider": _smtp_provider(cfg),
    }
