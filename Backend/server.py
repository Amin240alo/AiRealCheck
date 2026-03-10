from flask import Flask, request, jsonify, g, make_response

from flask_cors import CORS

import os
import sys
import hashlib
import datetime as dt
import json
import shutil
import subprocess
import time
import uuid
from typing import Tuple

from sqlalchemy import inspect, text
from dotenv import load_dotenv, find_dotenv

_DOTENV_PATH = find_dotenv(".env", usecwd=True)
if _DOTENV_PATH:
    load_dotenv(_DOTENV_PATH, override=False)


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _sightengine_creds_present():
    api_user = (os.getenv("SIGHTENGINE_API_USER") or "").strip()
    api_secret = (os.getenv("SIGHTENGINE_API_SECRET") or "").strip()
    if api_user and api_secret:
        return True
    api_key = (os.getenv("SIGHTENGINE_API_KEY") or "").strip()
    if not api_key:
        return False
    if ":" in api_key:
        parts = api_key.split(":", 1)
    elif "," in api_key:
        parts = api_key.split(",", 1)
    else:
        parts = [api_key, ""]
    api_user = parts[0].strip()
    api_secret = parts[1].strip() if len(parts) > 1 else ""
    return bool(api_user and api_secret)


def _reality_defender_creds_present():
    api_key = (os.getenv("REALITY_DEFENDER_API_KEY") or "").strip()
    return bool(api_key)


def _env_flag(name, default="false"):
    return os.getenv(name, default).lower() in {"1", "true", "yes"}


def _guest_analyze_enabled():
    return os.getenv("AIREALCHECK_ENABLE_GUEST_ANALYZE", "false").lower() in {"1", "true", "yes"}


def _client_ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr) or "?"


def _audio_enable_flags():
    return {
        "audio_aasist": _env_flag("AIREALCHECK_ENABLE_AUDIO_AASIST", "true"),
        "audio_forensics": _env_flag("AIREALCHECK_ENABLE_AUDIO_FORENSICS", "true"),
        "audio_prosody": _env_flag("AIREALCHECK_ENABLE_AUDIO_PROSODY", "true"),
    }


def _log_env_summary():
    dotenv_label = _DOTENV_PATH if _DOTENV_PATH else "none"
    paid_value = os.getenv("AIREALCHECK_USE_PAID_APIS")
    print(
        f"[env] dotenv_path={dotenv_label} "
        f"AIREALCHECK_USE_PAID_APIS={paid_value} "
        f"SIGHTENGINE_creds_present={_sightengine_creds_present()} "
        f"REALITY_DEFENDER_creds_present={_reality_defender_creds_present()}"
    )


_log_env_summary()


from Backend.ensemble import run_ensemble, build_standard_result, run_audio_ensemble
from Backend.public_result import build_public_result_v1, is_public_result
from Backend.engines.video_forensics_engine import run_video_forensics, log_ffmpeg_diagnostics
from Backend.engines.video_frame_detectors_engine import run_video_frame_detectors
from Backend.engines.reality_defender_video_engine import analyze_reality_defender_video
from Backend.engines.reality_defender_audio_engine import analyze_reality_defender_audio
from Backend.engines.video_temporal_engine import run_video_temporal
from Backend.engines.video_temporal_cnn_engine import run_video_temporal_cnn
from Backend.video_url_fetcher import fetch_video_from_url, VideoUrlError
from Backend.video_validation import validate_video_input
from Backend.engines.engine_utils import make_engine_result, safe_engine_call

from Backend.db import init_db, get_session, using_sqlite, engine

from Backend.models import Base, User, Analysis, AnalysisHistory
from Backend.history import bp_history, record_history_entry

from Backend.auth import bp_auth
from Backend.emailer import email_debug_status, send_email

from Backend.credits import (
    bp_credits,
    bp_api_credits,
    get_cost,
    ensure_has_credits,
    charge_credits_on_success,
    InsufficientCredits,
    get_available,
)

from Backend.analyses import bp_analyses

from Backend.admin import bp_admin, bp_api_admin

from Backend.middleware import require_email_verified, require_admin, _error, rate_limit

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, BASE_DIR)

sys.path.insert(0, os.path.join(BASE_DIR, "Backend"))



print("LOADED SERVER.PY FROM:", __file__)





app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB Upload-Limit
log_ffmpeg_diagnostics()


# Restrictive CORS per requirements
_allowed_origins = ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "http://127.0.0.1:3000"]
_allowed_methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
_allowed_headers = ["Content-Type", "Authorization", "Idempotency-Key"]

CORS(
    app,
    resources={
        r"/*": {
            "origins": _allowed_origins,
            "methods": _allowed_methods,
            "allow_headers": _allowed_headers,
        }
    },
    supports_credentials=True,
)



UPLOAD_DIR = "temp_upload"

os.makedirs(UPLOAD_DIR, exist_ok=True)



ALLOWED_IMAGE_EXTS = {

    ".jpg", ".jpeg", ".jfif",

    ".png", ".webp", ".bmp", ".gif",

    ".tif", ".tiff",

    ".heic", ".heif", ".avif",

    ".jp2", ".j2k", ".jpf", ".jpx",

    ".ico"

}



ALLOWED_VIDEO_EXTS = {
    ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".mpg", ".mpeg", ".3gp", ".ogv"
}

ALLOWED_AUDIO_EXTS = {
    ".wav", ".mp3", ".m4a", ".ogg", ".flac"
}

CACHE_PATH = os.path.join(UPLOAD_DIR, "results_cache.json")
_RESULT_CACHE = {}


def _load_cache():

    global _RESULT_CACHE

    try:

        if os.path.exists(CACHE_PATH):

            with open(CACHE_PATH, "r", encoding="utf-8") as f:

                _RESULT_CACHE = json.load(f)

    except Exception:

        _RESULT_CACHE = {}



def _save_cache():

    try:

        with open(CACHE_PATH, "w", encoding="utf-8") as f:

            json.dump(_RESULT_CACHE, f, ensure_ascii=False)

    except Exception:

        pass



_load_cache()





# Ensure analyses table has raw_result_json and backfill public_result_v1.
def _ensure_analysis_schema():
    try:
        inspector = inspect(engine)
        if "analyses" not in inspector.get_table_names():
            return
        columns = {col.get("name") for col in inspector.get_columns("analyses")}
        if "raw_result_json" not in columns:
            stmt = "ALTER TABLE analyses ADD COLUMN raw_result_json TEXT"
            if not using_sqlite():
                stmt = "ALTER TABLE analyses ADD COLUMN IF NOT EXISTS raw_result_json TEXT"
            with engine.begin() as conn:
                conn.execute(text(stmt))
    except Exception as exc:
        print(f"[schema] raw_result_json ensure failed: {type(exc).__name__}")
        return

    db = get_session()
    try:
        rows = db.query(Analysis).filter(Analysis.raw_result_json.is_(None)).all()
        if not rows:
            return
        for row in rows:
            raw_payload = row.result_json
            if raw_payload is None:
                row.raw_result_json = None
                continue
            public_candidate = raw_payload
            if isinstance(raw_payload, str):
                try:
                    parsed = json.loads(raw_payload)
                except Exception:
                    parsed = None
                if isinstance(parsed, dict):
                    public_candidate = parsed
            if isinstance(public_candidate, dict) and is_public_result(public_candidate):
                continue
            try:
                raw_text = (
                    raw_payload
                    if isinstance(raw_payload, str)
                    else json.dumps(raw_payload, ensure_ascii=False)
                )
            except Exception:
                raw_text = None
            row.raw_result_json = raw_text
            public_payload = build_public_result_v1(
                raw_payload,
                analysis_id=row.id,
                media_type=row.media_type,
                created_at=row.created_at,
            )
            row.result_json = public_payload
        db.commit()
        print(f"[schema] backfilled public_result_v1 rows={len(rows)}")
    except Exception as exc:
        db.rollback()
        print(f"[schema] backfill failed: {type(exc).__name__}")
    finally:
        db.close()

def _ensure_history_schema():
    """Add confidence_label column to analysis_history if missing (migration 008)."""
    try:
        inspector = inspect(engine)
        if "analysis_history" not in inspector.get_table_names():
            return
        columns = {col.get("name") for col in inspector.get_columns("analysis_history")}
        if "confidence_label" not in columns:
            stmt = "ALTER TABLE analysis_history ADD COLUMN confidence_label VARCHAR(20)"
            if not using_sqlite():
                stmt = "ALTER TABLE analysis_history ADD COLUMN IF NOT EXISTS confidence_label VARCHAR(20)"
            with engine.begin() as conn:
                conn.execute(text(stmt))
            print("[schema] analysis_history.confidence_label column added")
    except Exception as exc:
        print(f"[schema] confidence_label ensure failed: {type(exc).__name__}")


# Initialize database tables

def _ensure_user_language_schema():
    """Add language column to users if missing."""
    try:
        inspector = inspect(engine)
        if "users" not in inspector.get_table_names():
            return
        columns = {col.get("name") for col in inspector.get_columns("users")}
        if "language" not in columns:
            stmt = "ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'de'"
            if not using_sqlite():
                stmt = "ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'de'"
            with engine.begin() as conn:
                conn.execute(text(stmt))
            print("[schema] users.language column added")
    except Exception as exc:
        print(f"[schema] _ensure_user_language_schema error: {exc}")


init_db(Base)
_ensure_analysis_schema()
_ensure_history_schema()
_ensure_user_language_schema()



# Register blueprints

app.register_blueprint(bp_auth)

app.register_blueprint(bp_credits)
app.register_blueprint(bp_api_credits)

app.register_blueprint(bp_admin)
app.register_blueprint(bp_api_admin)

app.register_blueprint(bp_analyses)
app.register_blueprint(bp_history)


# ── Public plans endpoint (P1.6 – backend-dynamic pricing) ───────────────────

_PLANS_CONFIG = [
    {
        "id": "free",
        "name": "Free",
        "price_monthly": 0,
        "original_price": None,
        "savings_label": None,
        "badge_text": None,
        "highlighted": False,
        "credits_monthly": 100,
        "color": "#9ca3af",
        "checkout_available": False,
        "features": [
            "100 Credits pro Monat",
            "Bildanalyse (15 Credits / Datei)",
            "Audioanalyse (20 Credits / Datei)",
            "Videoanalyse (30 Credits / Datei)",
            "Analyse-Verlauf (30 Tage)",
            "E-Mail-Support",
        ],
        "limitations": [
            "Kein API-Zugang",
            "Standard-Engines",
            "Kein Priority-Support",
        ],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_monthly": 19,
        "original_price": 39,
        "savings_label": "Spare 51 %",
        "badge_text": "Beliebtester Plan",
        "highlighted": True,
        "credits_monthly": 1500,
        "color": "#22d3ee",
        "checkout_available": False,
        "features": [
            "1.500 Credits pro Monat",
            "Bildanalyse (15 Credits / Datei)",
            "Audioanalyse (20 Credits / Datei)",
            "Videoanalyse (30 Credits / Datei)",
            "Vollständiger Analyse-Verlauf",
            "Priorisierte Engine-Auswahl",
            "API-Zugang (Beta)",
            "Priority-E-Mail-Support",
        ],
        "limitations": None,
    },
    {
        "id": "business",
        "name": "Business",
        "price_monthly": 79,
        "original_price": 129,
        "savings_label": "Spare 39 %",
        "badge_text": "Best Value",
        "highlighted": False,
        "credits_monthly": 10000,
        "color": "#a78bfa",
        "checkout_available": False,
        "features": [
            "10.000 Credits pro Monat",
            "Bildanalyse (15 Credits / Datei)",
            "Audioanalyse (20 Credits / Datei)",
            "Videoanalyse (30 Credits / Datei)",
            "Vollständiger Analyse-Verlauf",
            "Alle Engines inkl. Premium-Engines",
            "API-Zugang inkl. höherem Rate-Limit",
            "Webhook-Unterstützung",
            "Dedizierter Support-Kanal",
            "Team-Nutzung (bald)",
        ],
        "limitations": None,
    },
]

_CREDIT_COSTS_CONFIG = {"image": 15, "audio": 20, "video": 30}


@app.get("/api/plans")
def api_get_plans():
    """Public endpoint – returns plan definitions for the pricing UI (P1.6)."""
    return jsonify({
        "ok": True,
        "plans": _PLANS_CONFIG,
        "credit_costs": _CREDIT_COSTS_CONFIG,
    })


# Simple in-memory rate limit: 30 req / 5 min per IP

# _RATE_BUCKET = {}

# _RATE_LIMIT = 30

# _RATE_WINDOW_SEC = 300

#

# @app.before_request

# def _rate_limiter():

#     try:

#         ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "?"

#         now = int(__import__("time").time())

#         bucket = _RATE_BUCKET.get(ip, [])

#         bucket = [t for t in bucket if now - t < _RATE_WINDOW_SEC]

#         bucket.append(now)

#         _RATE_BUCKET[ip] = bucket

#         if len(bucket) > _RATE_LIMIT:

#             app.logger.warning(f"rate_limit_exceeded ip={ip}")

#             return jsonify({"ok": False, "error": "rate_limited", "details": []}), 429

#     except Exception as e:

#         app.logger.error(f"rate_limit_error: {e}")

#         return None







def _is_image_ext(filename: str) -> bool:

    _, ext = os.path.splitext((filename or "").lower())

    return ext in ALLOWED_IMAGE_EXTS





def _is_video_ext(filename: str) -> bool:
    _, ext = os.path.splitext((filename or "").lower())
    return ext in ALLOWED_VIDEO_EXTS


def _is_audio_ext(filename: str) -> bool:
    _, ext = os.path.splitext((filename or "").lower())
    return ext in ALLOWED_AUDIO_EXTS


def _looks_like_image_magic(header: bytes) -> bool:
    if not header:
        return False
    if header.startswith(b"\xFF\xD8\xFF"):
        return True  # JPEG
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return True  # PNG
    if header.startswith(b"GIF87a") or header.startswith(b"GIF89a"):
        return True  # GIF
    if header.startswith(b"BM"):
        return True  # BMP
    if header.startswith(b"\x00\x00\x01\x00"):
        return True  # ICO
    if header.startswith(b"II*\x00") or header.startswith(b"MM\x00*"):
        return True  # TIFF
    if header.startswith(b"II+\x00") or header.startswith(b"MM\x00+"):
        return True  # BigTIFF
    if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WEBP":
        return True  # WebP
    if header.startswith(b"\x00\x00\x00\x0cjP  \r\n\x87\n"):
        return True  # JP2
    if header.startswith(b"\xFF\x4F\xFF\x51"):
        return True  # J2K codestream
    if len(header) >= 12 and header[4:8] == b"ftyp":
        brand = header[8:12]
        if brand in {b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1", b"heif", b"avif", b"avis"}:
            return True
    return False


def _ffprobe_stream_types(ffprobe_path: str, file_path: str):
    cmd = [
        ffprobe_path,
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        file_path,
    ]
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=4,
        check=False,
    )
    if proc.returncode != 0:
        return set()
    output = proc.stdout.decode("utf-8", errors="ignore") if proc.stdout else ""
    return {line.strip().lower() for line in output.splitlines() if line.strip()}


def _resolve_ffprobe_path():
    env_path = (os.getenv("FFMPEG_PATH") or "").strip()
    if env_path:
        if os.path.isdir(env_path):
            candidate = os.path.join(env_path, "ffprobe.exe" if os.name == "nt" else "ffprobe")
            if os.path.exists(candidate):
                return candidate
        if os.path.isfile(env_path):
            base_dir = os.path.dirname(env_path)
            candidate = os.path.join(base_dir, "ffprobe.exe" if os.name == "nt" else "ffprobe")
            if os.path.exists(candidate):
                return candidate
            if os.path.basename(env_path).lower().startswith("ffprobe") and os.path.exists(env_path):
                return env_path
    return shutil.which("ffprobe") or shutil.which("ffprobe.exe") or ""


def detect_media_type(file_path: str):
    status = {
        "method": None,
        "ffprobe": "not_available",
        "pil": "not_available",
        "magic": "not_available",
        "extension": "not_available",
        "notes": [],
    }
    if not file_path or not os.path.exists(file_path):
        status["notes"].append("file_missing")
        return "unknown", status
    try:
        if os.path.getsize(file_path) <= 0:
            status["notes"].append("file_size_0")
            return "unknown", status
    except Exception:
        status["notes"].append("file_stat_error")

    try:
        from PIL import Image
    except Exception:
        status["pil"] = "not_available"
    else:
        try:
            with Image.open(file_path) as img:
                img.verify()
                img_format = (img.format or "").strip()
            if img_format:
                status["pil"] = "ok"
                status["method"] = "pil"
                status["notes"].append(f"pil_format:{img_format.lower()}")
                return "image", status
            status["pil"] = "no_match"
        except Exception:
            status["pil"] = "error"

    try:
        with open(file_path, "rb") as f:
            header = f.read(64)
        if _looks_like_image_magic(header):
            status["magic"] = "ok"
            status["method"] = "magic"
            return "image", status
        status["magic"] = "no_match"
    except Exception:
        status["magic"] = "error"

    ffprobe_path = _resolve_ffprobe_path()
    if ffprobe_path and os.path.exists(ffprobe_path):
        try:
            stream_types = _ffprobe_stream_types(ffprobe_path, file_path)
            if "video" in stream_types:
                status["ffprobe"] = "ok"
                status["method"] = "ffprobe"
                return "video", status
            if "audio" in stream_types:
                status["ffprobe"] = "ok"
                status["method"] = "ffprobe"
                return "audio", status
            status["ffprobe"] = "no_match"
        except Exception:
            status["ffprobe"] = "error"
    else:
        status["ffprobe"] = "not_available"

    try:
        if _is_image_ext(file_path):
            status["extension"] = "ok"
            status["method"] = "extension"
            return "image", status
        if _is_video_ext(file_path):
            status["extension"] = "ok"
            status["method"] = "extension"
            return "video", status
        if _is_audio_ext(file_path):
            status["extension"] = "ok"
            status["method"] = "extension"
            return "audio", status
        status["extension"] = "no_match"
    except Exception:
        status["extension"] = "error"

    return "unknown", status


def _attach_media_type_detected(payload, media_type_detected, detection_meta=None):
    if isinstance(payload, dict):
        payload["media_type_detected"] = media_type_detected
        if detection_meta is not None and os.getenv("FLASK_ENV", "").lower() == "development":
            payload["media_type_detection"] = detection_meta
    return payload




def _sha256_of_file(path: str) -> str:

    h = hashlib.sha256()

    with open(path, "rb") as f:

        for chunk in iter(lambda: f.read(8192), b""):

            h.update(chunk)

    return h.hexdigest()





def _legacy_shaping_enabled() -> bool:
    return (
        os.getenv("AIREALCHECK_ENABLE_LEGACY_SHAPING", "false").lower() in {"1", "true", "yes"}
        or os.getenv("AIREALCHECK_SCORE_SHAPING", "false").lower() in {"1", "true", "yes"}
    )


def _apply_score_shaping(real: float, fake: float) -> Tuple[float, float]:
    """

    Optionales, monotones "Sharpening" der Verteilung für klarere Aussagen.

    Aktivierung per AIREALCHECK_ENABLE_LEGACY_SHAPING=true (legacy: AIREALCHECK_SCORE_SHAPING=true).
    """

    use_shaping = _legacy_shaping_enabled()
    if not use_shaping:

        return real, fake



    # In [0,1]

    p_fake = max(0.0, min(1.0, fake / 100.0))

    p_real = 1.0 - p_fake



    # Sharpen via temperature (gamma>1 -> polarisiert)

    gamma = float(os.getenv("AIREALCHECK_SHAPING_GAMMA", "2.5"))

    pf_g = p_fake ** gamma

    pr_g = p_real ** gamma

    denom = pf_g + pr_g if (pf_g + pr_g) > 0 else 1.0

    p_fake_s = pf_g / denom



    # Clamping bei sehr hoher Sicherheit

    if p_fake_s >= 0.98:

        p_fake_s = 0.98

    elif p_fake_s <= 0.02:

        p_fake_s = 0.02



    fake_s = p_fake_s * 100.0

    real_s = 100.0 - fake_s

    return real_s, fake_s


@app.get("/health")

def health():

    return jsonify({"ok": True})


@app.get("/debug/env")
def debug_env():
    paid_enabled = _paid_apis_enabled()
    return jsonify(
        {
            "cwd": os.getcwd(),
            "dotenv_path": _DOTENV_PATH if _DOTENV_PATH else "none",
            "AIREALCHECK_USE_PAID_APIS": os.getenv("AIREALCHECK_USE_PAID_APIS"),
            "sightengine": {
                "paid_apis_enabled": paid_enabled,
                "creds_present": _sightengine_creds_present(),
            },
            "reality_defender": {
                "paid_apis_enabled": paid_enabled,
                "creds_present": _reality_defender_creds_present(),
            },
        }
    )


@app.get("/debug/email")
def debug_email():
    return jsonify(email_debug_status())


@app.get("/debug/email/status")
@require_admin
def debug_email_status():
    return jsonify(email_debug_status())


def _debug_email_allowed():
    return os.getenv("FLASK_ENV", "").lower() == "development"


def _debug_email_test_impl():
    data = request.get_json(silent=True) or {}
    to_email = (data.get("email") or data.get("to") or "").strip().lower()
    if not to_email or "@" not in to_email:
        return _error("invalid_input", 400)
    subject = (data.get("subject") or "AIRealCheck: Test Email").strip()
    body = data.get("body") or "Dies ist eine Testmail vom AIRealCheck Debug Endpoint."
    ok, err, reason = send_email(
        to_email,
        subject,
        body,
        logger=app.logger,
        template_name="debug_test",
    )
    if not ok:
        return _error(err or "email_send_failed", 500, [reason] if reason else [])
    return jsonify({"ok": True, "reason": reason, "debug": email_debug_status()})


@require_admin
def _debug_email_test_admin():
    return _debug_email_test_impl()


@app.post("/debug/email/test")
def debug_email_test():
    if _debug_email_allowed():
        return _debug_email_test_impl()
    return _debug_email_test_admin()


@app.get("/debug/paid")
def debug_paid():
    paid_enabled = _paid_apis_enabled()
    return jsonify(
        {
            "cwd": os.getcwd(),
            "dotenv_path": _DOTENV_PATH if _DOTENV_PATH else "none",
            "AIREALCHECK_USE_PAID_APIS": os.getenv("AIREALCHECK_USE_PAID_APIS"),
            "sightengine": {
                "paid_apis_enabled": paid_enabled,
                "creds_present": _sightengine_creds_present(),
                "env_names_checked": [
                    "AIREALCHECK_USE_PAID_APIS",
                    "SIGHTENGINE_API_USER",
                    "SIGHTENGINE_API_SECRET",
                    "SIGHTENGINE_API_KEY",
                ],
            },
            "reality_defender": {
                "paid_apis_enabled": paid_enabled,
                "creds_present": _reality_defender_creds_present(),
                "env_names_checked": ["AIREALCHECK_USE_PAID_APIS", "REALITY_DEFENDER_API_KEY"],
            },
        }
    )





def _apply_no_cache_headers(resp):

    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"

    resp.headers["Pragma"] = "no-cache"

    resp.headers["Expires"] = "0"

    return resp


def _create_analysis_record(user_id: int, media_type: str):
    analysis_id = str(uuid.uuid4())
    charge_key = uuid.uuid4().hex
    now = dt.datetime.utcnow()
    db = get_session()
    try:
        row = Analysis(
            id=analysis_id,
            user_id=int(user_id),
            status="running",
            media_type=media_type,
            charge_idempotency_key=charge_key,
            started_at=now,
            created_at=now,
        )
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    return analysis_id, charge_key, now


def _finalize_analysis(
    analysis_id: str,
    status: str,
    result_json: dict = None,
    raw_result_json=None,
    final_score_ai01=None,
    cost_credits=None,
):
    db = get_session()
    try:
        row = db.query(Analysis).get(str(analysis_id))
        if not row:
            return
        row.status = status
        row.result_json = result_json
        if raw_result_json is not None:
            try:
                row.raw_result_json = (
                    raw_result_json
                    if isinstance(raw_result_json, str)
                    else json.dumps(raw_result_json, ensure_ascii=False)
                )
            except Exception:
                row.raw_result_json = None
        row.final_score_ai01 = final_score_ai01
        row.cost_credits = cost_credits
        row.finished_at = dt.datetime.utcnow()
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()





def _run_analysis(file_storage, media_type="image", user_ctx=None, charge_credit=False):

    if not file_storage or not getattr(file_storage, "filename", None):

        return jsonify(
            {
                "ok": False,
                "error": "no_file",
                "details": ["Keine Datei hochgeladen"],
                "media_type_detected": "unknown",
            }

        ), 400


    filename = os.path.basename(file_storage.filename)

    dst_path = os.path.join(UPLOAD_DIR, filename)

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    file_storage.save(dst_path)

    try:

        return _run_analysis_path(dst_path, filename, media_type, user_ctx, charge_credit)

    finally:

        try:

            if os.path.exists(dst_path):

                os.remove(dst_path)

        except Exception:

            pass





def _run_analysis_path(file_path, filename, media_type="image", user_ctx=None, charge_credit=False):

    result = None

    source_used = None

    file_hash = None

    use_cache = False

    media_type_detected = "unknown"

    detection_meta = None
    cost_credits = 0
    credit_spent = False
    credits_left = None
    user_id = None
    idempotency_key = None

    force = (request.args.get("force") or request.form.get("force") or "").lower() in {"1", "true", "yes", "force"}
    analysis_id = None
    created_at = dt.datetime.utcnow()
    created_at_iso = created_at.isoformat() + "Z"
    if user_ctx:
        user_id = int(user_ctx.get("id", 0))
        analysis_id, _, created_at = _create_analysis_record(user_id, media_type)
        created_at_iso = created_at.isoformat() + "Z"
    else:
        analysis_id = str(uuid.uuid4())

    IDEMPOTENCY_BUCKET_SEC = 600

    def _normalize_idempotency_key(value):
        key = (value or "").strip()
        if not key:
            return None
        if len(key) > 64:
            key = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return key

    def _resolve_idempotency_key(file_hash_value=None):
        nonlocal idempotency_key, file_hash
        if idempotency_key:
            return idempotency_key
        header_key = _normalize_idempotency_key(request.headers.get("Idempotency-Key"))
        if header_key:
            idempotency_key = header_key
            return idempotency_key
        if not file_hash_value:
            if not file_hash:
                file_hash = _sha256_of_file(file_path)
            file_hash_value = file_hash
        bucket = int(time.time() // IDEMPOTENCY_BUCKET_SEC)
        raw = f"{user_id}:{file_hash_value}:{bucket}"
        idempotency_key = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        return idempotency_key

    def _precheck_credits(required_cost):
        nonlocal cost_credits
        cost_credits = int(required_cost or 0)
        if not user_ctx or not charge_credit or cost_credits <= 0:
            return True, None
        db = get_session()
        try:
            ok, available = ensure_has_credits(db, user_id, cost_credits)
        finally:
            db.close()
        if not ok:
            error_payload = {
                "ok": False,
                "error": "insufficient_credits",
                "required": int(cost_credits),
                "available": int(available or 0),
                "details": ["Nicht genug Credits"],
                "media_type_detected": media_type_detected,
                "analysis_id": analysis_id,
            }
            if analysis_id:
                _finalize_failure(error_payload)
            return False, error_payload
        return True, None

    def _finalize_failure(payload):
        public_payload = build_public_result_v1(
            payload,
            analysis_id=analysis_id,
            media_type=media_type,
            created_at=created_at_iso,
        )
        if user_ctx and analysis_id:
            _finalize_analysis(
                analysis_id,
                "failed",
                result_json=public_payload,
                raw_result_json=payload,
                final_score_ai01=None,
                cost_credits=cost_credits,
            )
        return public_payload

    def _extract_final_score_ai01(raw_payload, public_payload):
        value = None
        if isinstance(raw_payload, dict):
            value = raw_payload.get("final_ai")
            if value is None:
                value = raw_payload.get("ai_likelihood")
        if value is None and isinstance(public_payload, dict):
            ai_percent = public_payload.get("summary", {}).get("ai_percent")
            if isinstance(ai_percent, (int, float)):
                value = float(ai_percent) / 100.0
        try:
            return float(value) if value is not None else None
        except Exception:
            return None

    def _finalize_success(raw_payload, source=None, public_payload=None):
        nonlocal credit_spent, credits_left
        if not isinstance(raw_payload, dict):
            raw_payload = {}
        if public_payload is None:
            public_payload = build_public_result_v1(
                raw_payload,
                analysis_id=analysis_id,
                media_type=media_type,
                created_at=created_at_iso,
            )
        final_score = _extract_final_score_ai01(raw_payload, public_payload)
        if user_ctx and charge_credit and cost_credits > 0:
            try:
                db = get_session()
                try:
                    credit_spent, credits_left = charge_credits_on_success(
                        db,
                        user_id,
                        cost_credits,
                        media_type,
                        analysis_id,
                        idempotency_key,
                    )
                finally:
                    db.close()
            except InsufficientCredits as exc:
                error_payload = {
                    "ok": False,
                    "error": "insufficient_credits",
                    "required": int(cost_credits),
                    "available": int(getattr(exc, "available", 0) or 0),
                    "details": ["Nicht genug Credits"],
                    "media_type_detected": media_type_detected,
                    "analysis_id": analysis_id,
                }
                if user_ctx and analysis_id:
                    _finalize_failure(error_payload)
                return error_payload, 409
        elif user_ctx and charge_credit:
            db = get_session()
            try:
                user_row = db.query(User).get(int(user_id))
                if user_row:
                    credits_left = get_available(user_row)
            finally:
                db.close()
        if user_ctx and analysis_id:
            _finalize_analysis(
                analysis_id,
                "done",
                result_json=public_payload,
                raw_result_json=raw_payload,
                final_score_ai01=final_score,
                cost_credits=cost_credits,
            )
        if user_ctx and analysis_id and isinstance(public_payload, dict):
            should_record = bool(cost_credits <= 0 or credit_spent)
            if should_record:
                credits_charged = int(cost_credits or 0) if credit_spent else 0
                record_history_entry(
                    user_id=user_id,
                    history_id=analysis_id,
                    media_type=media_type,
                    title=filename,
                    status="success",
                    payload=public_payload,
                    credits_charged=credits_charged,
                    created_at=created_at,
                    file_ref=None,
                    thumb_ref=None,
                    logger=app.logger,
                )
            else:
                app.logger.info(
                    "HISTORY_SAVE_SKIPPED history_id=%s user_id=%s reason=no_credit_charge",
                    analysis_id,
                    user_id,
                )
        if user_ctx:
            usage_source = source or raw_payload.get("primary_source") or "analysis"
        else:
            usage_source = "guest"
        response_payload = dict(public_payload) if isinstance(public_payload, dict) else {}
        response_payload["usage"] = {
            "source": usage_source,
            "credit_spent": bool(credit_spent),
            "credits_left": credits_left if user_ctx else None,
        }
        return response_payload

    try:

        media_type_detected, detection_meta = detect_media_type(file_path)

        if media_type_detected == "image" and media_type == "image":
            # Cache-Hit?

            ok, error_payload = _precheck_credits(get_cost("image"))
            if not ok:
                return jsonify(error_payload), 402

            use_cache = (os.getenv("AIREALCHECK_CACHE", "false").lower() in {"1", "true", "yes"})

            file_hash = _sha256_of_file(file_path)
            if user_ctx and charge_credit:
                idempotency_key = _resolve_idempotency_key(file_hash)

            if use_cache and (not force) and file_hash in _RESULT_CACHE:

                cached = dict(_RESULT_CACHE[file_hash])
                cached_is_public = is_public_result(cached)

                if (not cached_is_public) and ("ai_likelihood" not in cached or "engine_results" not in cached):

                    _RESULT_CACHE.pop(file_hash, None)

                else:

                    cached["analysis_id"] = analysis_id

                    cached["created_at"] = created_at_iso

                    if isinstance(cached.get("timestamps"), dict):

                        cached["timestamps"]["created_at"] = created_at_iso

                    else:

                        cached["timestamps"] = {"created_at": created_at_iso}

                    _attach_media_type_detected(cached, media_type_detected, detection_meta)
                    public_cached = cached if cached_is_public else build_public_result_v1(
                        cached,
                        analysis_id=analysis_id,
                        media_type=media_type,
                        created_at=created_at_iso,
                    )
                    if isinstance(public_cached.get("meta"), dict):
                        public_cached["meta"]["analysis_id"] = analysis_id
                        public_cached["meta"]["created_at"] = created_at_iso
                        if not public_cached["meta"].get("media_type"):
                            public_cached["meta"]["media_type"] = media_type
                    cached = _finalize_success(
                        cached,
                        source=cached.get("primary_source") or cached.get("source"),
                        public_payload=public_cached,
                    )
                    if isinstance(cached, tuple):
                        payload, status = cached
                        return jsonify(payload), status
                    return jsonify(cached)



            # Standard: Ensemble-Auswertung (Hive + Forensics)

            result = run_ensemble(file_path)

            source_used = result.get("primary_source")

        elif media_type_detected == "video" and media_type == "video":
            validation = validate_video_input(file_path, max_upload_bytes=app.config.get("MAX_CONTENT_LENGTH"))
            if not validation.get("ok"):
                error_payload = {
                    "ok": False,
                    "error": validation.get("message", "invalid_video"),
                    "details": validation.get("notes", []),
                    "validation": validation,
                    "media_type_detected": media_type_detected,
                    "analysis_id": analysis_id,
                }
                return (
                    jsonify(_finalize_failure(error_payload)),
                    int(validation.get("http_status") or 400),
                )

            duration_sec = validation.get("duration_sec")
            ok, error_payload = _precheck_credits(get_cost("video", duration_sec))
            if not ok:
                return jsonify(error_payload), 402
            if user_ctx and charge_credit:
                idempotency_key = _resolve_idempotency_key()

            video_forensics = safe_engine_call("video_forensics", run_video_forensics, file_path)
            video_detectors = safe_engine_call("video_frame_detectors", run_video_frame_detectors, file_path)
            reality_defender_video = safe_engine_call(
                "reality_defender_video", analyze_reality_defender_video, file_path
            )
            video_temporal_cnn = safe_engine_call("video_temporal_cnn", run_video_temporal_cnn, file_path)
            video_temporal = safe_engine_call("video_temporal", run_video_temporal, file_path)

            extra_engines = []
            if isinstance(video_detectors, dict):
                extra = video_detectors.get("extra_engine_results")
                if isinstance(extra, list):
                    extra_engines = [e for e in extra if isinstance(e, dict)]
            if extra_engines:
                extra_engines = [
                    e for e in extra_engines if e.get("engine") != "reality_defender_video"
                ]
            engine_results_raw = [video_detectors] + extra_engines
            engine_results_raw.extend(
                [reality_defender_video, video_temporal_cnn, video_temporal, video_forensics]
            )
            audio_from_video = os.getenv("AIREALCHECK_ENABLE_AUDIO_FROM_VIDEO", "false").lower() in {"1", "true", "yes"}
            if audio_from_video:
                audio_flags = _audio_enable_flags()
                try:
                    audio_bundle = run_audio_ensemble(file_path, enable_flags=audio_flags)
                    extra_audio = audio_bundle.get("engine_results_raw") if isinstance(audio_bundle, dict) else None
                    if isinstance(extra_audio, list):
                        engine_results_raw.extend([e for e in extra_audio if isinstance(e, dict)])
                except Exception as exc:
                    engine_results_raw.append(
                        make_engine_result(
                            engine="audio_forensics",
                            status="error",
                            notes=f"exception:{type(exc).__name__}",
                            available=False,
                            ai_likelihood=None,
                            confidence=0.0,
                            signals=["exception"],
                        )
                    )

            standard_payload = build_standard_result(
                media_type=media_type,
                engine_results_raw=engine_results_raw,
                analysis_id=analysis_id,
                ai_likelihood=None,

                reasons=None,

                created_at=created_at_iso,

            )



            response_payload = dict(standard_payload)

            response_payload["created_at"] = created_at_iso

            response_payload["real"] = response_payload.get("real_likelihood")

            response_payload["fake"] = response_payload.get("ai_likelihood")

            response_payload["legacy"] = {

                "verdict": response_payload.get("verdict"),

                "real": response_payload.get("real_likelihood"),

                "fake": response_payload.get("ai_likelihood"),

                "confidence": response_payload.get("confidence_label"),

                "primary_source": "video_forensics",

                "sources_used": [e.get("engine") for e in engine_results_raw if isinstance(e, dict) and e.get("available")],

                "user_summary": response_payload.get("reasons", []),

                "details": {},

                "warnings": [],

                "source": "video_forensics",

            }

            _attach_media_type_detected(response_payload, media_type_detected, detection_meta)
            response_payload = _finalize_success(response_payload, source="video_forensics")
            if isinstance(response_payload, tuple):
                payload, status = response_payload
                return jsonify(payload), status

            if os.getenv("FLASK_ENV", "").lower() == "development":
                response_payload["debug_flags"] = {
                    "video_forensics": {
                        "available": bool(video_forensics.get("available")),
                        "status": video_forensics.get("status"),
                    },
                    "video_frame_detectors": {
                        "available": bool(video_detectors.get("available")),
                        "status": video_detectors.get("status"),
                    },
                }
            return jsonify(response_payload)
        elif media_type_detected == "audio" and media_type == "audio":
            ok, error_payload = _precheck_credits(get_cost("audio"))
            if not ok:
                return jsonify(error_payload), 402
            if user_ctx and charge_credit:
                idempotency_key = _resolve_idempotency_key()

            audio_flags = _audio_enable_flags()
            audio_bundle = run_audio_ensemble(file_path, enable_flags=audio_flags)
            audio_primary_source = "audio_aasist"
            if isinstance(audio_bundle, dict):
                audio_primary_source = audio_bundle.get("primary_source") or audio_primary_source
            engine_results_raw = audio_bundle.get("engine_results_raw") if isinstance(audio_bundle, dict) else []
            if not isinstance(engine_results_raw, list):
                engine_results_raw = []
            reality_defender_audio = safe_engine_call(
                "reality_defender_audio", analyze_reality_defender_audio, file_path
            )
            engine_results_raw.append(reality_defender_audio)

            standard_payload = build_standard_result(
                media_type=media_type,
                engine_results_raw=engine_results_raw,
                analysis_id=analysis_id,
                ai_likelihood=None,
                reasons=None,
                created_at=created_at_iso,
            )

            response_payload = dict(standard_payload)
            response_payload["created_at"] = created_at_iso
            response_payload["real"] = response_payload.get("real_likelihood")
            response_payload["fake"] = response_payload.get("ai_likelihood")
            response_payload["legacy"] = {
                "verdict": response_payload.get("verdict"),
                "real": response_payload.get("real_likelihood"),
                "fake": response_payload.get("ai_likelihood"),
                "confidence": response_payload.get("confidence_label"),
                "primary_source": audio_primary_source,
                "sources_used": [
                    e.get("engine")
                    for e in engine_results_raw
                    if isinstance(e, dict) and e.get("available")
                ],
                "user_summary": response_payload.get("reasons", []),
                "details": {},
                "warnings": audio_bundle.get("warnings", []) if isinstance(audio_bundle, dict) else [],
                "source": audio_primary_source,
            }
            _attach_media_type_detected(response_payload, media_type_detected, detection_meta)
            response_payload = _finalize_success(response_payload, source=audio_primary_source)
            if isinstance(response_payload, tuple):
                payload, status = response_payload
                return jsonify(payload), status
            return jsonify(response_payload)
        else:
            error_payload = {
                "ok": False,
                "error": "Nicht unterstützter Dateityp",
                "media_type_detected": media_type_detected,
                "analysis_id": analysis_id,
            }
            return (jsonify(_finalize_failure(error_payload)), 415)


        if result.get("error") or result.get("ok") is False:
            error_payload = {
                "ok": False,
                "error": result.get("message", "analyse_failed"),
                "details": result.get("details", []),
                "media_type_detected": media_type_detected,
                "analysis_id": analysis_id,
            }
            return (jsonify(_finalize_failure(error_payload)), 502)


        # Score-Shaping optional anwenden

        real = float(result.get("real", 0))

        fake = float(result.get("fake", 0))

        real, fake = _apply_score_shaping(real, fake)



        # Runden (ganzzahliger Prozentwert gewuenscht?)

        as_int = (os.getenv("AIREALCHECK_RETURN_INTS", "true").lower() in {"1", "true", "yes"})

        if as_int:

            real_out = int(round(real))

            fake_out = int(round(fake))

            # Korrigiere Summenfehler

            diff = 100 - (real_out + fake_out)

            if diff != 0:

                # justiere die groessere Klasse

                if real_out >= fake_out:

                    real_out += diff

                else:

                    fake_out += diff

        else:

            real_out = round(real, 2)

            fake_out = round(fake, 2)



        confidence_value = result.get("confidence") or "low"



        debug_paid = result.get("debug_paid") if isinstance(result, dict) else None
        standard_payload = build_standard_result(

            media_type=media_type,

            engine_results_raw=result.get("engine_results_raw", []),

            analysis_id=analysis_id,

            ai_likelihood=None,

            reasons=None,

            created_at=created_at_iso,

            debug_paid=debug_paid,

        )



        response_payload = dict(standard_payload)

        response_payload["created_at"] = created_at_iso

        response_payload["legacy"] = {
            "is_legacy": True,
            "note": "Legacy-Scores; nicht für das Urteil verwendet.",

            "verdict": result.get("verdict"),

            "real": real_out,

            "fake": fake_out,

            "confidence": confidence_value,

            "primary_source": result.get("primary_source"),

            "sources_used": result.get("sources_used", []),

            "user_summary": result.get("user_summary", []),

            "details": result.get("details", {}),

            "warnings": result.get("warnings", []),

            "source": result.get("primary_source"),

        }

        _attach_media_type_detected(response_payload, media_type_detected, detection_meta)
        response_payload["real"] = response_payload.get("real_likelihood")

        response_payload["fake"] = response_payload.get("ai_likelihood")



        raw_payload = response_payload
        response_payload = _finalize_success(raw_payload, source=source_used)
        if isinstance(response_payload, tuple):
            payload, status = response_payload
            return jsonify(payload), status



        # Cache speichern

        try:

            if use_cache:

                _RESULT_CACHE[file_hash] = raw_payload

                _save_cache()

        except Exception:

            pass



        return jsonify(response_payload)

    except Exception as e:
        error_payload = {
            "ok": False,
            "error": str(e),
            "media_type_detected": media_type_detected,
            "analysis_id": analysis_id,
        }
        return jsonify(_finalize_failure(error_payload)), 500


@app.post("/analyze")
@require_email_verified
def analyze():

    file = request.files.get("file")

    media_type = (request.form.get("type") or "image").lower()

    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        user_ctx = {"id": user.id, "is_premium": bool(user.is_premium)}
    finally:
        db.close()

    resp = _run_analysis(file, media_type, user_ctx, charge_credit=True)

    if isinstance(resp, tuple):

        resp_obj, status = resp

    else:

        resp_obj, status = resp, 200

    if hasattr(resp_obj, "get_json"):

        data = resp_obj.get_json()

        if data is not None:

            resp_obj = data

    if not isinstance(resp_obj, dict) or "usage" not in resp_obj:

        resp_final = make_response(resp_obj, status)

        return _apply_no_cache_headers(resp_final)

    if "media_type_detected" not in resp_obj:

        resp_obj["media_type_detected"] = "unknown"

    resp_final = make_response(jsonify(resp_obj), status)

    return _apply_no_cache_headers(resp_final)



print("REGISTRIERE ANALYZE-GUEST ROUTE")



@app.post("/analyze/guest")

def analyze_guest():
    if not _guest_analyze_enabled():
        return _error("guest_disabled", 403)
    if not rate_limit(f"guest_analyze:{_client_ip()}", limit=10, window_sec=600):
        return _error("rate_limited", 429)
    file = request.files.get("file")

    media_type = (request.form.get("type") or "image").lower()



    # Keine Auth, kein Token, keine DB Credits

    user_ctx = None



    # Analyse ohne Credit-Abzug

    resp = _run_analysis(file, media_type, user_ctx, charge_credit=False)



    # Response normalisieren

    if isinstance(resp, tuple):

        resp_obj, status = resp

    else:

        resp_obj, status = resp, 200



    if hasattr(resp_obj, "get_json"):

        data = resp_obj.get_json()

        if data is not None:

            resp_obj = data



    # usage-Block garantieren

    if not isinstance(resp_obj, dict):

        resp_final = make_response(resp_obj, status)

        return _apply_no_cache_headers(resp_final)

    if "usage" not in resp_obj:

        resp_obj["usage"] = {}

    if "media_type_detected" not in resp_obj:

        resp_obj["media_type_detected"] = "unknown"


    resp_obj["usage"]["source"] = "guest"

    resp_obj["usage"]["credit_spent"] = False

    resp_obj["usage"]["credits_left"] = None



    resp_final = make_response(jsonify(resp_obj), status)
    return _apply_no_cache_headers(resp_final)


@app.post("/analyze/video-url")
@require_email_verified
def analyze_video_url():
    db = get_session()
    try:
        user = db.query(User).get(int(g.current_user_id))
        if not user:
            return _error("user_not_found", 404)
        user_ctx = {"id": user.id, "is_premium": bool(user.is_premium)}
    finally:
        db.close()
    resp = _handle_video_url_request(user_ctx, charge_credit=True, as_guest=False)
    if isinstance(resp, tuple):
        resp_obj, status = resp
    else:
        resp_obj, status = resp, 200
    resp_final = make_response(resp_obj, status)
    return _apply_no_cache_headers(resp_final)


@app.post("/analyze/video-url/guest")
def analyze_video_url_guest():
    if not _guest_analyze_enabled():
        return _error("guest_disabled", 403)
    if not rate_limit(f"guest_analyze:{_client_ip()}", limit=10, window_sec=600):
        return _error("rate_limited", 429)
    resp = _handle_video_url_request(None, charge_credit=False, as_guest=True)
    if isinstance(resp, tuple):
        resp_obj, status = resp
    else:
        resp_obj, status = resp, 200
    resp_final = make_response(resp_obj, status)
    return _apply_no_cache_headers(resp_final)


def _handle_video_url_request(user_ctx, charge_credit=False, as_guest=False):
    data = request.get_json(silent=True) or request.form or {}
    url = (data.get("url") or data.get("video_url") or "").strip()
    if not url:
        return jsonify(
            {"ok": False, "error": "url_missing", "details": ["URL fehlt"], "media_type_detected": "unknown"}
        ), 400
    try:
        path, info = fetch_video_from_url(url)
    except VideoUrlError as e:
        return (
            jsonify({"ok": False, "error": e.code, "details": [e.message], "media_type_detected": "unknown"}),
            e.status,
        )
    except Exception:
        return jsonify(
            {"ok": False, "error": "download_failed", "details": ["Download fehlgeschlagen"], "media_type_detected": "unknown"}
        ), 502

    filename = os.path.basename(path)
    try:
        resp = _run_analysis_path(path, filename, media_type="video", user_ctx=user_ctx, charge_credit=charge_credit)
        if isinstance(resp, tuple):
            resp_obj, status = resp
        else:
            resp_obj, status = resp, 200
        if hasattr(resp_obj, "get_json"):
            data = resp_obj.get_json()
            if data is not None:
                resp_obj = data
        if not isinstance(resp_obj, dict):
            return resp_obj, status
        if "usage" not in resp_obj:
            resp_obj["usage"] = {}
        if as_guest:
            resp_obj["usage"]["source"] = "guest"
            resp_obj["usage"]["credit_spent"] = False
            resp_obj["usage"]["credits_left"] = None
        if "media_type_detected" not in resp_obj:
            resp_obj["media_type_detected"] = "unknown"
        return jsonify(resp_obj), status
    finally:
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass








if __name__ == "__main__":

    app.run(host="127.0.0.1", port=5001, debug=True)













