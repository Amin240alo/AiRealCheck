# backend/image_forensics.py
from PIL import Image, ImageChops, ExifTags
import numpy as np
import cv2
import io
import os
import imagehash
try:
    import pillow_heif  # HEIF/HEIC/AVIF Support for Pillow
    pillow_heif.register_heif_opener()
except Exception:
    pass

AI_HINT_KEYWORDS = [
    "stable diffusion", "midjourney", "dall-e", "dalle", "sdxl",
    "generative", "ai", "diffusion", "comfyui", "invokeai"
]


def _to_cv_gray(pil_img: Image.Image):
    arr = np.array(pil_img.convert("RGB"))
    return cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)


def _ela_score(pil_img: Image.Image, quality: int = 95):
    """
    ELA (Error Level Analysis): Wir speichern als JPEG (Qualität=95),
    vergleichen Original mit der recompress-ten Version. Hoher Unterschied => eher künstlich/bearbeitet.
    """
    buf = io.BytesIO()
    pil_img.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    comp = Image.open(buf).convert("RGB")
    diff = ImageChops.difference(pil_img.convert("RGB"), comp)

    # Unterschied verstärken (ohne extra Import)
    ar = (np.array(diff).astype(np.float32) * 10.0)
    ar = np.clip(ar, 0, 255).astype(np.uint8)
    diff_np = ar

    return float(diff_np.mean()), float(diff_np.max())


def _exif_info(pil_img: Image.Image):
    exif_data = {}
    try:
        raw = pil_img.getexif()
        if raw:
            for k, v in raw.items():
                tag = ExifTags.TAGS.get(k, str(k))
                exif_data[tag] = str(v).lower()
    except Exception:
        pass
    return exif_data


def _exif_ai_hints(exif_data: dict):
    text = " ".join([f"{k}:{v}" for k, v in exif_data.items()]).lower()
    hits = [kw for kw in AI_HINT_KEYWORDS if kw in text]
    return hits


def _sharpness_variance(gray):
    # Varianz des Laplacian ~ Schärfe. Sehr niedrige Werte => stark geglättet/untypisch.
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _high_freq_ratio(gray):
    """
    Grober HF-Indikator: Anteil hoher Frequenzen (Fourierraum).
    Unnatürliche HF-Muster können Hinweis auf KI sein.
    """
    f = np.fft.fft2(gray)
    fshift = np.fft.fftshift(f)
    mag = np.log1p(np.abs(fshift))

    h, w = mag.shape
    cy, cx = h // 2, w // 2
    r = min(cy, cx) // 2
    center = mag[cy - r:cy + r, cx - r:cx + r]
    total = mag.sum() + 1e-6
    center_sum = center.sum()
    high = total - center_sum
    return float(high / total)


def _phash_distance(pil_img: Image.Image):
    """
    pHash-Stabilitätscheck: Bild neu komprimieren und Hash-Abstand vergleichen.
    Große Differenz => instabil => verdächtig.
    """
    try:
        ph = imagehash.phash(pil_img)
        buf = io.BytesIO()
        pil_img.save(buf, "JPEG", quality=85)
        buf.seek(0)
        comp = Image.open(buf)
        ph2 = imagehash.phash(comp)
        return int(ph - ph2)  # Hamming-Distanz
    except Exception:
        return 0


def analyze_image(file_path: str):
    """
    Kombiniert einfache Bildforensik:
    - ELA (mean/max)
    - EXIF (KI-Hinweise)
    - Schärfe (Varianz)
    - Hochfrequenz-Anteil
    - pHash-Distanz
    Liefert Scores 0..100 (Fake) / 100..0 (Real) + Details.
    """
    assert os.path.exists(file_path), "Datei existiert nicht"

    # Robust laden: Pillow (mit HEIF/AVIF wenn verfügbar), Fallback über OpenCV
    def _open_image_robust(path: str) -> Image.Image:
        try:
            img0 = Image.open(path)
            # Bei animierten Formaten (GIF/WEBP) den ersten Frame nehmen
            try:
                if getattr(img0, "is_animated", False):
                    img0.seek(0)
            except Exception:
                pass
            return img0.convert("RGB")
        except Exception:
            # Fallback via OpenCV -> PIL
            try:
                with open(path, "rb") as f:
                    data = np.frombuffer(f.read(), dtype=np.uint8)
                bgr = cv2.imdecode(data, cv2.IMREAD_COLOR)
                if bgr is None:
                    raise ValueError("OpenCV konnte das Bild nicht laden")
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                return Image.fromarray(rgb)
            except Exception as e:
                raise e

    img = _open_image_robust(file_path)
    gray = _to_cv_gray(img)

    # 1) ELA
    ela_mean, ela_max = _ela_score(img)

    # 2) EXIF
    ex = _exif_info(img)
    ex_ai = _exif_ai_hints(ex)

    # 3) Schärfe
    sharp_var = _sharpness_variance(gray)

    # 4) Hochfrequenz
    hf_ratio = _high_freq_ratio(gray)

    # 5) pHash-Stabilität
    phash_dist = _phash_distance(img)

    # --- Heuristische Kombination (Baseline) ---
    fake_score = 0.0

    # ELA: hoher Mittelwert -> eher Fake
    fake_score += min(100.0, (ela_mean / 8.0) * 25.0)  # bis ~25

    # EXIF AI-Hints: starker Hinweis
    if ex_ai:
        fake_score += 30.0

    # HF-Ratio: sehr niedrig/hoch => unnatürlich
    if hf_ratio < 0.50:
        fake_score += (0.50 - hf_ratio) * 60.0  # bis ~30
    elif hf_ratio > 0.85:
        fake_score += (hf_ratio - 0.85) * 80.0  # bis ~12

    # Schärfe: sehr niedrig => verdächtig
    if sharp_var < 20:
        fake_score += (20 - sharp_var) * 1.0  # bis ~20

    # pHash: große Differenz => verdächtig
    if phash_dist > 15:
        fake_score += 15.0
    elif phash_dist > 8:
        fake_score += 8.0
    elif phash_dist > 4:
        fake_score += 4.0

    fake_score = max(0.0, min(100.0, fake_score))
    real_score = 100.0 - fake_score

    if real_score >= 70:
        msg = "Echt mit hoher Wahrscheinlichkeit"
    elif real_score <= 30:
        msg = "Starke Hinweise auf KI-Generierung"
    else:
        msg = "Mischsignale – weitere Prüfung empfohlen"

    details = [
        f"ELA mean/max: {ela_mean:.2f} / {ela_max:.2f}",
        f"Schärfe (Varianz): {sharp_var:.1f}",
        f"Hochfrequenz-Anteil: {hf_ratio:.3f}",
        f"pHash-Distanz: {phash_dist}",
    ]
    if ex_ai:
        details.append(f"EXIF-Hinweise auf KI: {', '.join(ex_ai)}")
    else:
        if ex:
            details.append("EXIF vorhanden: keine KI-Hinweise gefunden")
        else:
            details.append("Keine EXIF-Daten (neutral)")

    return {
        "real": int(round(real_score)),
        "fake": int(round(fake_score)),
        "message": msg,
        "details": details,
    }
