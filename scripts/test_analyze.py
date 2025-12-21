import os
from io import BytesIO
from PIL import Image
from server import app


def make_sample_image(path: str):
    img = Image.new("RGB", (128, 128), (180, 60, 200))
    img.save(path, format="PNG")


def main():
    test_path = os.path.join("temp_upload", "sample.png")
    os.makedirs("temp_upload", exist_ok=True)
    make_sample_image(test_path)

    with app.test_client() as c:
        with open(test_path, "rb") as f:
            data = {"file": (f, "sample.png")}
            r = c.post("/analyze", data=data, content_type="multipart/form-data")
            print("/analyze:", r.status_code)
            try:
                print(r.get_json())
            except Exception:
                print(r.data[:300])


if __name__ == "__main__":
    main()

