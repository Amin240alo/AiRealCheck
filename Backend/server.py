from flask import Flask, request, jsonify, g, make_response

from flask_cors import CORS

import os
import sys
import hashlib
import json
import shutil
import subprocess
import uuid
from typing import Tuple
from dotenv import load_dotenv, find_dotenv

import jwt

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
from Backend.engines.video_forensics_engine import run_video_forensics, log_ffmpeg_diagnostics
from Backend.engines.video_frame_detectors_engine import run_video_frame_detectors
from Backend.engines.video_temporal_engine import run_video_temporal
from Backend.engines.video_temporal_cnn_engine import run_video_temporal_cnn
from Backend.video_url_fetcher import fetch_video_from_url, VideoUrlError
from Backend.video_validation import validate_video_input
from Backend.engines.engine_utils import make_engine_result, coerce_engine_result, safe_engine_call

from Backend.db import init_db

from Backend.models import Base, User

from Backend.auth import bp_auth

from Backend.credits import bp_credits

from Backend.admin import bp_admin

from Backend.middleware import spend_one_credit, get_session, parse_auth_header, ensure_daily_reset

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, BASE_DIR)

sys.path.insert(0, os.path.join(BASE_DIR, "Backend"))



print("LOADED SERVER.PY FROM:", __file__)





JWT_SECRET = os.getenv("AIREALCHECK_JWT_SECRET", "dev_change_me")





app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB Upload-Limit
log_ffmpeg_diagnostics()


# Restrictive CORS per requirements

_allowed_origins = ["http://127.0.0.1:5500", "http://127.0.0.1:5000"]

CORS(app, resources={r"/*": {"origins": _allowed_origins}})



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





# Initialize database tables

init_db(Base)



# Register blueprints

app.register_blueprint(bp_auth)

app.register_blueprint(bp_credits)

app.register_blueprint(bp_admin)



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

    force = (request.args.get("force") or request.form.get("force") or "").lower() in {"1", "true", "yes", "force"}
    analysis_id = str(uuid.uuid4())

    created_at_iso = __import__("datetime").datetime.utcnow().isoformat() + "Z"

    try:

        media_type_detected, detection_meta = detect_media_type(file_path)

        if media_type_detected == "image" and media_type == "image":
            # Cache-Hit?

            use_cache = (os.getenv("AIREALCHECK_CACHE", "false").lower() in {"1", "true", "yes"})

            file_hash = _sha256_of_file(file_path)

            if use_cache and (not force) and file_hash in _RESULT_CACHE:

                cached = dict(_RESULT_CACHE[file_hash])

                if "ai_likelihood" not in cached or "engine_results" not in cached:

                    _RESULT_CACHE.pop(file_hash, None)

                else:

                    cached["analysis_id"] = analysis_id

                    cached["created_at"] = created_at_iso

                    if isinstance(cached.get("timestamps"), dict):

                        cached["timestamps"]["created_at"] = created_at_iso

                    else:

                        cached["timestamps"] = {"created_at": created_at_iso}

                    cached["usage"] = {"source": cached.get("source"), "credit_spent": False, "credits_left": None}

                    _attach_media_type_detected(cached, media_type_detected, detection_meta)
                    return jsonify(cached)



            # Standard: Ensemble-Auswertung (Hive + Forensics)

            result = run_ensemble(file_path)

            source_used = result.get("primary_source")

        elif media_type_detected == "video" and media_type == "video":
            validation = validate_video_input(file_path, max_upload_bytes=app.config.get("MAX_CONTENT_LENGTH"))
            if not validation.get("ok"):
                return (
                    jsonify(
                        {
                            "ok": False,
                            "error": validation.get("message", "invalid_video"),
                            "details": validation.get("notes", []),
                            "validation": validation,
                            "media_type_detected": media_type_detected,
                        }
                    ),
                    int(validation.get("http_status") or 400),
                )

            video_forensics = safe_engine_call("video_forensics", run_video_forensics, file_path)
            video_detectors = safe_engine_call("video_frame_detectors", run_video_frame_detectors, file_path)
            video_temporal_cnn = safe_engine_call("video_temporal_cnn", run_video_temporal_cnn, file_path)
            video_temporal = safe_engine_call("video_temporal", run_video_temporal, file_path)

            extra_engines = []
            if isinstance(video_detectors, dict):
                extra = video_detectors.get("extra_engine_results")
                if isinstance(extra, list):
                    extra_engines = [e for e in extra if isinstance(e, dict)]
            engine_results_raw = [video_detectors] + extra_engines
            engine_results_raw.extend([video_temporal_cnn, video_temporal, video_forensics])
            audio_from_video = os.getenv("AIREALCHECK_ENABLE_AUDIO_FROM_VIDEO", "false").lower() in {"1", "true", "yes"}
            if audio_from_video:
                try:
                    audio_bundle = run_audio_ensemble(file_path)
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

            response_payload["usage"] = {

                "source": "video_forensics",

                "credit_spent": False,

                "credits_left": None,

            }

            _attach_media_type_detected(response_payload, media_type_detected, detection_meta)

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
            audio_bundle = run_audio_ensemble(file_path)
            audio_primary_source = "audio_aasist"
            if isinstance(audio_bundle, dict):
                audio_primary_source = audio_bundle.get("primary_source") or audio_primary_source
            engine_results_raw = audio_bundle.get("engine_results_raw") if isinstance(audio_bundle, dict) else []
            if not isinstance(engine_results_raw, list):
                engine_results_raw = []

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
            response_payload["usage"] = {
                "source": audio_primary_source,
                "credit_spent": False,
                "credits_left": None,
            }
            _attach_media_type_detected(response_payload, media_type_detected, detection_meta)
            return jsonify(response_payload)
        else:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "Nicht unterstuetzter Dateityp",
                        "media_type_detected": media_type_detected,
                    }
                ),
                415,
            )


        if result.get("error") or result.get("ok") is False:

            return (
                jsonify(
                    {
                        "ok": False,
                        "error": result.get("message", "analyse_failed"),
                        "details": result.get("details", []),
                        "media_type_detected": media_type_detected,
                    }
                ),
                502,
            )


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
            "note": "Legacy-Scores; nicht fuer das Urteil verwendet.",

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



        # Spend credit atomically after successful analysis for hive/forensics

        credit_spent = False

        credits_left = None

        if charge_credit and user_ctx and source_used in {"hive", "forensics"}:

            try:

                credits_left = spend_one_credit(user_ctx.get("id", 0), reason=f"analyze:{source_used}")

                credit_spent = True

            except Exception as e:

                return (
                    jsonify({"ok": False, "error": str(e), "details": [], "media_type_detected": media_type_detected}),
                    402,
                )


        response_payload["usage"] = {

            "source": source_used,

            "credit_spent": credit_spent,

            "credits_left": credits_left if user_ctx else None,

        }



        # Cache speichern

        try:

            if use_cache:

                _RESULT_CACHE[file_hash] = response_payload

                _save_cache()

        except Exception:

            pass



        return jsonify(response_payload)

    except Exception as e:

        return jsonify({"ok": False, "error": str(e), "media_type_detected": media_type_detected}), 500


def _resolve_user_context():

    try:

        token = parse_auth_header()

        if not token:

            app.logger.debug("resolve_user_context: no auth header")

            return None

        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

        user_id = payload.get("sub")

        if not user_id:

            app.logger.debug("resolve_user_context: payload missing sub")

            return None

        db = get_session()

        try:

            user = db.query(User).get(int(user_id))

            if not user:

                app.logger.debug("resolve_user_context: user not found %s", user_id)

                return None

            g.current_user_id = user.id

            g.current_user_is_premium = bool(user.is_premium)

            g.current_user_is_admin = bool(getattr(user, "is_admin", False))

            ensure_daily_reset(user, db)

            db.commit()

            return {

                "id": user.id,

                "is_premium": bool(user.is_premium),

                "is_admin": bool(getattr(user, "is_admin", False)),

            }

        finally:

            db.close()

    except Exception:

        app.logger.exception("resolve_user_context error")

        pass

    return None





@app.post("/analyze")

def analyze():

    file = request.files.get("file")

    media_type = (request.form.get("type") or "image").lower()

    user_ctx = _resolve_user_context()

    resp = _run_analysis(file, media_type, user_ctx, charge_credit=bool(user_ctx))

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
    if user_ctx:

        resp_obj["usage"]["source"] = resp_obj["usage"].get("source")

    else:

        resp_obj["usage"]["source"] = "guest"

        resp_obj["usage"]["credits_left"] = None

    resp_final = make_response(jsonify(resp_obj), status)

    return _apply_no_cache_headers(resp_final)



print("REGISTRIERE ANALYZE-GUEST ROUTE")



@app.post("/analyze/guest")

def analyze_guest():
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
def analyze_video_url():
    user_ctx = _resolve_user_context()
    resp = _handle_video_url_request(user_ctx, charge_credit=bool(user_ctx), as_guest=False)
    if isinstance(resp, tuple):
        resp_obj, status = resp
    else:
        resp_obj, status = resp, 200
    resp_final = make_response(resp_obj, status)
    return _apply_no_cache_headers(resp_final)


@app.post("/analyze/video-url/guest")
def analyze_video_url_guest():
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













