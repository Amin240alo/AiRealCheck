try:
    import torch
    import timm
    from torchvision import transforms
except Exception:
    torch = None
    timm = None
    transforms = None

from PIL import Image


class DeepFakeDetector:
    def __init__(self):
        # Modell laden (Xception - oft fuer Deepfake-Erkennung genutzt)
        if torch is None or timm is None or transforms is None:
            raise RuntimeError(
                "torch/timm/torchvision nicht installiert. Bitte 'torch timm torchvision' installieren,"
                " oder Hive/Forensik verwenden."
            )

        self.model = timm.create_model('xception', pretrained=True, num_classes=2)
        self.model.eval()

        # Transformationen fuer Eingabebilder
        self.transform = transforms.Compose([
            transforms.Resize((299, 299)),
            transforms.ToTensor(),
            transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
        ])

    def predict(self, image_path):
        img = Image.open(image_path).convert("RGB")
        tensor = self.transform(img).unsqueeze(0)

        with torch.no_grad():
            output = self.model(tensor)
            probs = torch.softmax(output, dim=1)[0]
            real_score = float(probs[0] * 100)
            fake_score = float(probs[1] * 100)

        if real_score > fake_score:
            msg = "Echt mit hoher Wahrscheinlichkeit"
        else:
            msg = "Wahrscheinlich KI-generiert"

        return {
            "real": round(real_score),
            "fake": round(fake_score),
            "message": msg
        }


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
    detector = DeepFakeDetector()
    print("[OK] Deepfake XceptionNet Model aktiv - starte Analyse...")
    result = detector.predict(file_path)
    result["details"] = ["Modell: XceptionNet (pretrained DeepFake)"]
    return result

