try:
    import torch
    import timm
    from torchvision import transforms
except Exception:
    torch = None
    timm = None
    transforms = None

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

from PIL import Image


class DeepFakeDetector:
    def __init__(self):
        # Modell laden (Xception - oft fuer Deepfake-Erkennung genutzt)
        if torch is None or timm is None or transforms is None:
            raise RuntimeError(
                "torch/timm/torchvision nicht installiert. Bitte 'torch timm torchvision' installieren,"
                " oder Hive/Forensik verwenden."
            )

        _enable_determinism()
        self.model = timm.create_model('xception', pretrained=True, num_classes=2)
        self.model.eval()

        # Transformationen fuer Eingabebilder (deterministic per crop)
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

    def predict(self, image_path):
        img = Image.open(image_path).convert("RGB")
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
    Wrapper-Funktion fuer Server-Aufruf.
    Nutzt die DeepFakeDetector-Klasse, um ein Bild zu analysieren.
    """
    _enable_determinism()
    detector = DeepFakeDetector()
    print("[OK] Deepfake XceptionNet Model aktiv - starte Analyse...")
    result = detector.predict(file_path)
    result["details"] = ["Modell: XceptionNet (pretrained DeepFake)"]
    return result
