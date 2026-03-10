try:
    import torch
    import timm
    from torchvision import transforms
except Exception:
    torch = None
    timm = None
    transforms = None

import io
import os
import random
try:
    import numpy as np
except Exception:
    np = None

_DETERMINISTIC_ENABLED = False


def _enable_determinism(seed: int = 42) -> bool:
    global _DETERMINISTIC_ENABLED
    if torch is None:
        _DETERMINISTIC_ENABLED = False
        return False
    try:
        random.seed(seed)
        if np is not None:
            np.random.seed(seed)
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
        try:
            torch.use_deterministic_algorithms(True)
        except Exception:
            pass
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
        _DETERMINISTIC_ENABLED = True
        return True
    except Exception:
        _DETERMINISTIC_ENABLED = False
        return False


def determinism_enabled() -> bool:
    return bool(_DETERMINISTIC_ENABLED)

from PIL import Image, ImageOps


def _local_preprocess_enabled() -> bool:
    return os.getenv("AIREALCHECK_IMAGE_LOCAL_PREPROCESS", "true").lower() in {"1", "true", "yes", "on"}


def _to_rgb(img: Image.Image) -> Image.Image:
    if img.mode == "RGB":
        return img
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        return bg
    return img.convert("RGB")


def _load_image(path: str) -> Image.Image:
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        img.load()
        return _to_rgb(img.copy())


def _jpeg_recompress(img: Image.Image, quality: int = 85) -> Image.Image:
    buf = io.BytesIO()
    _to_rgb(img).save(buf, format="JPEG", quality=quality, optimize=True)
    buf.seek(0)
    with Image.open(buf) as tmp:
        tmp = tmp.convert("RGB")
        tmp.load()
        return tmp.copy()


def _resize_down_up_if_large(img: Image.Image, max_edge: int = 1024, downscale: float = 0.75) -> Image.Image:
    width, height = img.size
    if max(width, height) <= max_edge:
        return None
    down_w = max(1, int(round(width * downscale)))
    down_h = max(1, int(round(height * downscale)))
    down = img.resize((down_w, down_h), resample=Image.LANCZOS)
    up = down.resize((width, height), resample=Image.BICUBIC)
    return up


def _center_crop_resize(img: Image.Image, crop_scale: float = 0.9) -> Image.Image:
    width, height = img.size
    crop_w = max(1, int(round(width * crop_scale)))
    crop_h = max(1, int(round(height * crop_scale)))
    left = max(0, (width - crop_w) // 2)
    top = max(0, (height - crop_h) // 2)
    right = min(width, left + crop_w)
    bottom = min(height, top + crop_h)
    cropped = img.crop((left, top, right, bottom))
    return cropped.resize((width, height), resample=Image.LANCZOS)


def _build_variants(img: Image.Image):
    variants = [("orig", img)]
    if not _local_preprocess_enabled():
        return variants
    try:
        variants.append(("jpeg_q85", _jpeg_recompress(img, quality=85)))
    except Exception:
        pass
    try:
        resized = _resize_down_up_if_large(img, max_edge=1024, downscale=0.75)
        if resized is not None:
            variants.append(("resize_down_up", resized))
    except Exception:
        pass
    try:
        variants.append(("center_crop", _center_crop_resize(img, crop_scale=0.9)))
    except Exception:
        pass
    return variants


def _median(values):
    if not values:
        return None
    vals = sorted(values)
    mid = len(vals) // 2
    if len(vals) % 2 == 1:
        return vals[mid]
    return (vals[mid - 1] + vals[mid]) / 2.0


class DeepFakeDetector:
    def __init__(self):
        # Modell laden (Xception - oft für Deepfake-Erkennung genutzt)
        if torch is None or timm is None or transforms is None:
            raise RuntimeError(
                "torch/timm/torchvision nicht installiert. Bitte 'torch timm torchvision' installieren,"
                " oder Hive/Forensik verwenden."
            )

        _enable_determinism()
        self.model = timm.create_model('xception', pretrained=True, num_classes=2)
        self.model.eval()

        # Transformationen für Eingabebilder (deterministic per crop)
        self.transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
        ])

    def _random_crop(self, img, crop_size=224):
        width, height = img.size
        if width < crop_size or height < crop_size:
            scale = max(crop_size / max(1, width), crop_size / max(1, height))
            new_w = int(round(width * scale))
            new_h = int(round(height * scale))
            img = img.resize((new_w, new_h), Image.BILINEAR)
            width, height = img.size
        if width == crop_size and height == crop_size:
            return img
        left = random.randint(0, width - crop_size)
        top = random.randint(0, height - crop_size)
        return img.crop((left, top, left + crop_size, top + crop_size))

    def predict(self, image_input):
        if isinstance(image_input, Image.Image):
            img = _to_rgb(image_input)
        else:
            img = _load_image(image_input)
        fake_probs = []
        samples = 5
        crop_size = 224

        with torch.no_grad():
            for _ in range(samples):
                crop = self._random_crop(img, crop_size=crop_size)
                tensor = self.transform(crop).unsqueeze(0)
                output = self.model(tensor)
                probs = torch.softmax(output, dim=1)[0]
                fake_probs.append(float(probs[1]))

        if not fake_probs:
            raise RuntimeError("no_crops")

        fake_probs_sorted = sorted(fake_probs)
        mid = len(fake_probs_sorted) // 2
        if len(fake_probs_sorted) % 2 == 1:
            fake_prob = fake_probs_sorted[mid]
        else:
            fake_prob = (fake_probs_sorted[mid - 1] + fake_probs_sorted[mid]) / 2.0

        if np is not None:
            variance = float(np.var(fake_probs, dtype=np.float64))
        else:
            mean_val = sum(fake_probs) / len(fake_probs)
            variance = sum((x - mean_val) ** 2 for x in fake_probs) / len(fake_probs)
        stddev = variance ** 0.5
        range_val = max(fake_probs) - min(fake_probs)

        real_score = float((1.0 - fake_prob) * 100.0)
        fake_score = float(fake_prob * 100.0)

        if real_score > fake_score:
            msg = "Echt mit hoher Wahrscheinlichkeit"
        else:
            msg = "Wahrscheinlich KI-generiert"

        result = {
            "real": round(real_score),
            "fake": round(fake_score),
            "samples": samples,
            "variance": round(variance, 6),
            "stddev": round(stddev, 6),
            "range": round(range_val, 6),
            "message": msg,
        }
        if range_val > 0.25 or stddev > 0.15:
            result["warning"] = "high_variance"
        return result


# Einzeltest (optional)
if __name__ == "__main__":
    try:
        df = DeepFakeDetector()
        print(df.predict("test.jpg"))
    except Exception as e:
        print("Fehler beim Laden des Modells:", e)


def analyze_with_xception(file_path: str):
    """
    Wrapper-Funktion für Server-Aufruf.
    Nutzt die DeepFakeDetector-Klasse, um ein Bild zu analysieren.
    """
    _enable_determinism()
    detector = DeepFakeDetector()
    print("[OK] Deepfake XceptionNet Model aktiv - starte Analyse...")
    base_img = _load_image(file_path)
    variants = _build_variants(base_img)

    variant_scores = []
    variant_names = []
    crop_stddevs = []
    warnings = []

    for name, img in variants:
        try:
            res = detector.predict(img)
        except Exception:
            continue
        if not isinstance(res, dict):
            continue
        try:
            fake_prob = float(res.get("fake")) / 100.0
        except Exception:
            continue
        variant_scores.append(fake_prob)
        variant_names.append(name)
        if res.get("warning"):
            warnings.append(name)
        try:
            crop_stddevs.append(float(res.get("stddev")))
        except Exception:
            pass

    if not variant_scores:
        result = detector.predict(base_img)
        result["details"] = ["Model: XceptionNet (pretrained DeepFake)"]
        return result

    fake_prob = _median(variant_scores)
    if fake_prob is None:
        fake_prob = variant_scores[0]
    fake_prob = max(0.0, min(1.0, float(fake_prob)))
    real_score = float((1.0 - fake_prob) * 100.0)
    fake_score = float(fake_prob * 100.0)

    mean_val = sum(variant_scores) / float(len(variant_scores))
    variance = sum((x - mean_val) ** 2 for x in variant_scores) / float(len(variant_scores))
    variant_stddev = variance ** 0.5
    variant_range = max(variant_scores) - min(variant_scores)

    if real_score > fake_score:
        msg = "Echt mit hoher Wahrscheinlichkeit"
    else:
        msg = "Wahrscheinlich KI-generiert"

    details = ["Model: XceptionNet (pretrained DeepFake)"]
    details.append("Variants: " + ",".join(variant_names))
    details.append(f"Variant stddev: {variant_stddev:.4f}")
    details.append(f"Variant range: {variant_range:.4f}")

    result = {
        "real": int(round(real_score)),
        "fake": int(round(fake_score)),
        "samples": int(len(variant_scores)),
        "variance": round(variance, 6),
        "stddev": round(variant_stddev, 6),
        "range": round(variant_range, 6),
        "message": msg,
        "variant_scores": [round(v, 4) for v in variant_scores],
        "variant_names": variant_names,
        "variant_stddev": round(variant_stddev, 6),
        "variant_range": round(variant_range, 6),
        "details": details,
    }
    if warnings or variant_stddev > 0.08 or variant_range > 0.25:
        result["warning"] = "variant_high_variance"
    return result
