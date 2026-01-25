from flask import Flask, request, jsonify, g
from flask_cors import CORS
import os
import hashlib
import json
from typing import Tuple
from dotenv import load_dotenv
import jwt

from Backend.image_forensics import analyze_image
from Backend.deepfake_api import analyze_with_hive
from Backend.db import init_db
from Backend.models import Base, User
from Backend.auth import bp_auth
from Backend.credits import bp_credits
from Backend.admin import bp_admin
from Backend.middleware import spend_one_credit, get_session, parse_auth_header, ensure_daily_reset

import sys, os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
sys.path.insert(0, os.path.join(BASE_DIR, "Backend"))

print("LOADED SERVER.PY FROM:", __file__)


JWT_SECRET = os.getenv("AIREALCHECK_JWT_SECRET", "dev_change_me")


load_dotenv()  # lade .env damit Flags wie AIREALCHECK_IMAGE_FALLBACK wirken
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB Upload-Limit

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


def _sha256_of_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _apply_score_shaping(real: float, fake: float) -> Tuple[float, float]:
    """
    Optionales, monotones "Sharpening" der Verteilung für klarere Aussagen.
    Aktivierung per AIREALCHECK_SCORE_SHAPING=true.
    """
    use_shaping = (os.getenv("AIREALCHECK_SCORE_SHAPING", "false").lower() in {"1", "true", "yes"})
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


def _run_analysis(file_storage, media_type="image", user_ctx=None, charge_credit=False):
    if not file_storage or not getattr(file_storage, "filename", None):
        return jsonify({"ok": False, "error": "no_file", "details": ["Keine Datei hochgeladen"]}), 400

    filename = os.path.basename(file_storage.filename)
    dst_path = os.path.join(UPLOAD_DIR, filename)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_storage.save(dst_path)

    result = None
    source_used = None
    try:
        if _is_image_ext(filename):
            # Cache-Hit?
            use_cache = (os.getenv("AIREALCHECK_CACHE", "true").lower() in {"1", "true", "yes"})
            file_hash = _sha256_of_file(dst_path)
            if use_cache and file_hash in _RESULT_CACHE:
                cached = dict(_RESULT_CACHE[file_hash])
                cached["usage"] = {"source": cached.get("source"), "credit_spent": False, "credits_left": None}
                return jsonify(cached)

            # Standard: Nur Hive für Konsistenz; Fallback per ENV steuerbar
            use_fallback = (os.getenv("AIREALCHECK_IMAGE_FALLBACK", "false").lower() in {"1", "true", "yes"})
            result = analyze_with_hive(dst_path)
            if result.get("error") and use_fallback:
                result = analyze_image(dst_path)
                result["source"] = "forensics"
                source_used = "forensics"
            else:
                result["source"] = result.get("source", "hive")
                source_used = result["source"]
        else:
            return jsonify({"ok": False, "error": "Nicht unterstützter Dateityp"}), 415

        if result.get("error"):
            return jsonify({"ok": False, "error": result.get("message", "analyse_failed"), "details": result.get("details", [])}), 502

        # Score-Shaping optional anwenden
        real = float(result.get("real", 0))
        fake = float(result.get("fake", 0))
        real, fake = _apply_score_shaping(real, fake)

        # Runden (ganzzahliger Prozentwert gewünscht?)
        as_int = (os.getenv("AIREALCHECK_RETURN_INTS", "true").lower() in {"1", "true", "yes"})
        if as_int:
            real_out = int(round(real))
            fake_out = int(round(fake))
            # Korrigiere Summenfehler
            diff = 100 - (real_out + fake_out)
            if diff != 0:
                # justiere die größere Klasse
                if real_out >= fake_out:
                    real_out += diff
                else:
                    fake_out += diff
        else:
            real_out = round(real, 2)
            fake_out = round(fake, 2)

        response_payload = {
            "ok": True,
            "real": real_out,
            "fake": fake_out,
            "message": result.get("message"),
            "details": result.get("details", []),
            "source": result.get("source"),
        }

        # Spend credit atomically after successful analysis for hive/forensics
        credit_spent = False
        credits_left = None
        if charge_credit and user_ctx and source_used in {"hive", "forensics"}:
            try:
                credits_left = spend_one_credit(user_ctx.get("id", 0), reason=f"analyze:{source_used}")
                credit_spent = True
            except Exception as e:
                return jsonify({"ok": False, "error": str(e), "details": []}), 402

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
        return jsonify({"ok": False, "error": str(e)}), 500
    finally:
        try:
            if os.path.exists(dst_path):
                os.remove(dst_path)
        except Exception:
            pass

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
        return resp_obj, status
    if user_ctx:
        resp_obj["usage"]["source"] = resp_obj["usage"].get("source")
    else:
        resp_obj["usage"]["source"] = "guest"
        resp_obj["usage"]["credits_left"] = None
    return resp_obj, status

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
    if "usage" not in resp_obj:
        resp_obj["usage"] = {}

    resp_obj["usage"]["source"] = "guest"
    resp_obj["usage"]["credit_spent"] = False
    resp_obj["usage"]["credits_left"] = None

    return resp_obj, status




if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
