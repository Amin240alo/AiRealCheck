import os
import io
import base64
import requests
from dotenv import load_dotenv
from PIL import Image, ImageOps
try:
    import pillow_heif  # optional für HEIC/AVIF
    pillow_heif.register_heif_opener()
except Exception:
    pass

# .env laden, falls vorhanden (lokale Entwicklung/Tests)
load_dotenv()

# API-Key aus Umgebung lesen (bevorzugt "HIVE_API_KEY")
HIVE_API_KEY = os.getenv("HIVE_API_KEY") or os.getenv("AIREALCHECK_HIVE_API_KEY") or ""
# Modell-Priorität: zuerst allgemeine KI-Bild-Detektion, dann Deepfake als Fallback
_default_models = [
    "ai-generated-image-detection",
    "synthetic-image-detection",
    "deepfake-detection",
]
HIVE_MODELS = [m.strip() for m in (os.getenv("HIVE_MODELS", ",".join(_default_models))).split(",") if m.strip()]
TTA_COUNT = int(os.getenv("AIREALCHECK_TTA", "3") or 3)  # 1..5 sinnvoll


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

    # Numerisch säubern und auf 2 Nachkommastellen runden
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
    Sendet das Bild an Hive AI zur Analyse (Real vs Fake).
    Erwartet einen Pfad zu einer existierenden Bilddatei.
    Rückgabe: Dict mit Schlüsseln: real, fake, message, details | bei Fehler: error, message, details
    """
    if not os.path.exists(file_path):
        return {"error": True, "message": "Datei existiert nicht", "details": [file_path]}

    if not HIVE_API_KEY:
        return {
            "error": True,
            "message": "HIVE_API_KEY fehlt. Bitte .env setzen.",
            "details": [
                "Setze HIVE_API_KEY in der Umgebung oder .env",
                "Alternativ: AIREALCHECK_HIVE_API_KEY",
            ],
        }

    # Standardisierte Vorverarbeitung: RGB, Skalierung, JPEG(qual=95)
    max_edge = int(os.getenv("AIREALCHECK_MAX_EDGE", "1024") or 1024)
    def _prep_variants(path: str):
        variants = []
        try:
            base = Image.open(path).convert("RGB")
            w, h = base.size
            scale = 1.0
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
    # Wir versuchen die Modelle in vorgegebener Reihenfolge, bis eins klappt
    errors = []

    for model_name in HIVE_MODELS:
        payload = {"model": model_name, "input": [{"image": v} for v in variants]}
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
        except requests.RequestException as e:
            errors.append(f"{model_name}: {str(e)}")
            continue

        if response.status_code != 200:
            errors.append(f"{model_name}: {response.status_code} {response.text[:200]}")
            # Bei 403 evtl. Bearer versuchen
            if response.status_code == 403 and "Invalid Auth Token" in (response.text or ""):
                try:
                    headers_retry = dict(headers)
                    headers_retry["Authorization"] = f"Bearer {HIVE_API_KEY}"
                    response = requests.post(url, headers=headers_retry, json=payload, timeout=45)
                except requests.RequestException as e:
                    errors.append(f"{model_name} retry: {str(e)}")
                    continue
                if response.status_code != 200:
                    errors.append(f"{model_name} retry: {response.status_code} {response.text[:200]}")
                    continue
            else:
                continue

        try:
            data = response.json()
        except ValueError:
            errors.append(f"{model_name}: invalid JSON")
            continue

        try:
            status = data.get("status") or []
            if not status:
                raise KeyError("status fehlt")
            response_obj = status[0].get("response", {})
            outputs = response_obj.get("output") or []
            if not outputs:
                raise KeyError("output fehlt")

            # Aggregate über TTA-Outputs
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

            msg = "Echt mit hoher Wahrscheinlichkeit" if real_score > fake_score else "Wahrscheinlich KI-generiert"
            return {
                "real": real_score,
                "fake": fake_score,
                "message": msg,
                "details": [
                    f"Hive Model: {model_name}",
                    f"Preprocessing: {prep_details}",
                    f"TTA: {n} variants (avg)",
                    f"Raw: {raws}",
                ],
                "source": "hive",
            }
        except Exception as e:
            errors.append(f"{model_name}: parse error {str(e)}")
            continue

    return {"error": True, "message": "Hive-Analyse fehlgeschlagen (alle Modelle)", "details": errors}
