import os
import io
import base64
import requests
from dotenv import load_dotenv
from PIL import Image, ImageOps
try:
    import pillow_heif  # optional fÃ¼r HEIC/AVIF
    pillow_heif.register_heif_opener()
except Exception:
    pass

# .env laden, falls vorhanden (lokale Entwicklung/Tests)
load_dotenv()

# API-Key aus Umgebung lesen (bevorzugt "HIVE_API_KEY")
HIVE_API_KEY = os.getenv("HIVE_API_KEY") or os.getenv("AIREALCHECK_HIVE_API_KEY") or ""
# Modell-PrioritÃ¤t: zuerst allgemeine KI-Bild-Detektion, dann Deepfake als Fallback
_default_models = [
    "ai-generated-image-detection",
    "synthetic-image-detection",
    "deepfake-detection",
]
HIVE_MODELS = [m.strip() for m in (os.getenv("HIVE_MODELS", ",".join(_default_models))).split(",") if m.strip()]
TTA_COUNT = int(os.getenv("AIREALCHECK_TTA", "3") or 3)  # 1..5 sinnvoll


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _normalize_classes(classes):
    """Mappt unterschiedliche Bezeichner auf 'real'/'fake' und liefert Scores in [0, 100]."""
    real = None
    fake = None
    raw = []
    for item in classes or []:
        label = str(item.get("class", "")).strip().lower()
        score = float(item.get("score", 0.0))
        # Erwartet 0..1, safeguard
        if score > 1.0:
            # falls bereits Prozent kamen (z.B. 87.3)
            score = score / 100.0
        raw.append({"class": label, "score": score})

        if label in {"real", "non_fake", "authentic", "genuine"}:
            real = score * 100.0
        elif label in {"fake", "ai", "ai_generated", "synthetic", "deepfake"}:
            fake = score * 100.0

    # Wenn nur einer vorhanden ist: Gegenpart ableiten
    if real is None and fake is not None:
        real = max(0.0, min(100.0, 100.0 - fake))
    if fake is None and real is not None:
        fake = max(0.0, min(100.0, 100.0 - real))

    # Falls beide None, setze neutral
    if real is None and fake is None:
        real, fake = 50.0, 50.0

    # Numerisch sÃ¤ubern und auf 2 Nachkommastellen runden
    real = max(0.0, min(100.0, float(real)))
    fake = max(0.0, min(100.0, float(fake)))

    # Zwingen, dass sie zu 100% aufsummieren (kleine Abweichungen korrigieren)
    total = real + fake
    if 0.0 < total:
        real = real * 100.0 / total
        fake = fake * 100.0 / total

    return round(real, 2), round(fake, 2), raw


def analyze_with_hive(file_path: str):
    """
    Global AI detection (works for any image) + optional Face/Deepfake signal (only when needed).
    Rückgabe bleibt kompatibel: real, fake, message, details, source | bei Fehler: error, message, details
    """
    if not _paid_apis_enabled():
        return {
            "error": True,
            "ok": False,
            "message": "Hive disabled (paid APIs off)",
            "details": ["Hive disabled (AIREALCHECK_USE_PAID_APIS=false)"],
        }
    if not os.path.exists(file_path):
        return {"error": True, "message": "Datei existiert nicht", "details": [file_path]}

    if not HIVE_API_KEY:
        return {
            "error": True,
            "ok": False,
            "message": "HIVE_API_KEY fehlt. Bitte .env setzen.",
            "details": ["Hive: API Key fehlt oder ist leer"],
        }

    # --- Preprocessing Varianten (TTA) ---
    max_edge = int(os.getenv("AIREALCHECK_MAX_EDGE", "1024") or 1024)

    def _prep_variants(path: str):
        variants = []
        try:
            base = Image.open(path).convert("RGB")
            w, h = base.size
            if max(w, h) > max_edge:
                scale = max_edge / float(max(w, h))
                base = base.resize((int(w * scale), int(h * scale)))
            imgs = [base]
            if TTA_COUNT >= 2:
                imgs.append(ImageOps.mirror(base))
            if TTA_COUNT >= 3:
                imgs.append(ImageOps.flip(base))
            if TTA_COUNT >= 4:
                imgs.append(base.rotate(5, resample=Image.BICUBIC, expand=False))
            if TTA_COUNT >= 5:
                imgs.append(base.rotate(-5, resample=Image.BICUBIC, expand=False))

            for im in imgs[:max(1, TTA_COUNT)]:
                buf = io.BytesIO()
                im.save(buf, format="JPEG", quality=95, optimize=True)
                buf.seek(0)
                variants.append(base64.b64encode(buf.read()).decode("utf-8"))
            pd = f"standardized RGB JPEG q95 {base.size[0]}x{base.size[1]} (TTA={len(variants)})"
            return variants, pd
        except Exception:
            with open(path, "rb") as f:
                raw = base64.b64encode(f.read()).decode("utf-8")
            return [raw], "raw file base64 (no PIL)"

    variants, prep_details = _prep_variants(file_path)

    url = "https://api.thehive.ai/api/v2/task/sync"
    headers = {
        "Authorization": f"Token {HIVE_API_KEY}",
        "Content-Type": "application/json",
    }

    debug_raw = os.getenv("AIREALCHECK_DEBUG_RAW", "false").lower() in {"1", "true", "yes"}
    if debug_raw and HIVE_API_KEY:
        print(f"HIVE_API_KEY prefix: {HIVE_API_KEY[:6]}...")
    force_face = os.getenv("AIREALCHECK_FORCE_FACE", "false").lower() in {"1", "true", "yes"}

    # --- Modellgruppen ---
    # global: funktioniert auch ohne Gesicht
    global_candidates = [m for m in HIVE_MODELS if m in {"ai-generated-image-detection", "synthetic-image-detection"}]
    # face/deepfake: eher nur sinnvoll bei Faces/Manipulationen
    face_candidates = [m for m in HIVE_MODELS if m in {"deepfake-detection"}]

    # Fallback: falls User HIVE_MODELS leer/anders gesetzt hat
    if not global_candidates:
        global_candidates = ["ai-generated-image-detection", "synthetic-image-detection"]
    if not face_candidates:
        face_candidates = ["deepfake-detection"]

    errors = []
    details = [f"Preprocessing: {prep_details}"]
    auth_error = None

    def _call_model(model_name: str):
        nonlocal auth_error
        payload = {"model": model_name, "input": [{"image": v} for v in variants]}
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=45)
        except requests.RequestException as e:
            return None, [f"{model_name}: {str(e)}"]

        if r.status_code in {401, 403}:
            auth_error = "Hive Auth Fehler (401/403) – prüfe API Key / Authorization Header"
            return None, [auth_error]

        if r.status_code != 200:
            return None, [f"{model_name}: {r.status_code} {(r.text or '')[:200]}"]

        try:
            data = r.json()
        except ValueError:
            return None, [f"{model_name}: invalid JSON"]

        try:
            status = data.get("status") or []
            if not status:
                raise KeyError("status fehlt")
            response_obj = status[0].get("response", {})
            outputs = response_obj.get("output") or []
            if not outputs:
                raise KeyError("output fehlt")

            agg_real, agg_fake = 0.0, 0.0
            raws = []
            for out in outputs:
                classes = out.get("classes", [])
                real_score, fake_score, raw = _normalize_classes(classes)
                agg_real += real_score
                agg_fake += fake_score
                raws.append(raw)
            n = max(1, len(outputs))
            real_score = round(agg_real / n, 2)
            fake_score = round(agg_fake / n, 2)

            return {
                "model": model_name,
                "real": real_score,
                "fake": fake_score,
                "tta": n,
                "raws": raws if debug_raw else None,
            }, []
        except Exception as e:
            return None, [f"{model_name}: parse error {str(e)}"]

    # --- 1) GLOBAL FIRST ---
    global_result = None
    for m in global_candidates:
        res, errs = _call_model(m)
        if errs:
            errors.extend(errs)
        if res:
            global_result = res
            break
        if auth_error:
            return {"ok": False, "error": True, "message": auth_error, "details": [auth_error]}

    if global_result:
        details.append(f"Hive Global Model: {global_result['model']}")
        details.append(f"Global Score: {global_result['real']}% real / {global_result['fake']}% KI")
        details.append(f"TTA: {global_result['tta']} variants (avg)")
        if debug_raw and global_result.get("raws") is not None:
            details.append(f"Raw(Global): {global_result['raws']}")
    else:
        details.append("Hive Global: nicht verfügbar (alle Modelle fehlgeschlagen)")

    # --- Entscheid, ob wir Face/Deepfake callen ---
    # Unsicherheitszone: 40-60% KI (oder wenn global fehlt)
    need_face = force_face
    if not need_face:
        if global_result is None:
            need_face = True
        else:
            gf = float(global_result["fake"])
            need_face = (40.0 <= gf <= 60.0)

    face_result = None
    if need_face:
        for m in face_candidates:
            res, errs = _call_model(m)
            if errs:
                errors.extend(errs)
            if res:
                face_result = res
                break
            if auth_error:
                return {"ok": False, "error": True, "message": auth_error, "details": [auth_error]}

        if face_result:
            details.append(f"Hive Face Model: {face_result['model']}")
            details.append(f"Face/Deepfake Score: {face_result['real']}% real / {face_result['fake']}% KI")
            details.append(f"TTA: {face_result['tta']} variants (avg)")
            if debug_raw and face_result.get("raws") is not None:
                details.append(f"Raw(Face): {face_result['raws']}")
        else:
            details.append("Hive Face/Deepfake: nicht verfügbar")

    # --- Overall Fusion (konservativ, ohne “Fake-Mathe”) ---
    # Regel:
    # - Nimm primär Global
    # - Wenn Face sehr stark "KI" sagt (>=85), erhöhe Overall auf max(Global, Face)
    # - Wenn Global fehlt, nimm Face
    if global_result is None and face_result is None:
        return {"error": True, "message": "Hive-Analyse fehlgeschlagen (alle Modelle)", "details": errors or details}

    if global_result is not None:
        overall_fake = float(global_result["fake"])
    else:
        overall_fake = float(face_result["fake"])

    if face_result is not None and float(face_result["fake"]) >= 85.0:
        overall_fake = max(overall_fake, float(face_result["fake"]))

    overall_fake = max(0.0, min(100.0, overall_fake))
    overall_real = round(100.0 - overall_fake, 2)
    overall_fake = round(overall_fake, 2)

    # --- Confidence (hoch/mittel/niedrig) ---
    # basiert auf Abstand + Stärke, nicht als “echte Wahrscheinlichkeit” verkauft
    gap = abs(overall_real - overall_fake)
    top = max(overall_real, overall_fake)
    if top >= 80.0 and gap >= 30.0:
        confidence = "high"
    elif top >= 65.0 and gap >= 15.0:
        confidence = "medium"
    else:
        confidence = "low"

    # Message kompatibel halten, aber besser formulieren
    if confidence == "high":
        msg = "Hohe Sicherheit: wahrscheinlich echt" if overall_real > overall_fake else "Hohe Sicherheit: wahrscheinlich KI-generiert"
    elif confidence == "medium":
        msg = "Mittlere Sicherheit: eher echt" if overall_real > overall_fake else "Mittlere Sicherheit: eher KI-generiert"
    else:
        msg = "Mischsignale – weitere Prüfung empfohlen"

    details.append(f"Overall: {overall_real}% echt / {overall_fake}% KI (confidence={confidence})")

    # Optional: Fehlerliste nur anhängen, wenn vorhanden
    if errors:
        details.append(f"Hive Notes: {len(errors)} issues (siehe Debug/Logs)")

    return {
        "real": overall_real,
        "fake": overall_fake,
        "message": msg,
        "details": details,
        "source": "hive",
        "confidence": confidence,  # frontend ignoriert das erstmal, aber wir haben es
    }

