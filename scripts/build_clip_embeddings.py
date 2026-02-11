import argparse
import os
import sys
import time

try:
    import torch
except Exception:
    torch = None

try:
    import numpy as np
except Exception:
    np = None

try:
    from PIL import Image
except Exception:
    Image = None

open_clip = None
openai_clip = None
CLIP_BACKEND = ""
CLIP_IMPORT_ERROR = None

try:
    import open_clip as _open_clip

    open_clip = _open_clip
    CLIP_BACKEND = "open_clip"
except Exception as exc:
    CLIP_IMPORT_ERROR = str(exc)[:240]

if open_clip is None:
    try:
        import clip as _openai_clip

        openai_clip = _openai_clip
        CLIP_BACKEND = "openai_clip"
        CLIP_IMPORT_ERROR = None
    except Exception as exc:
        if CLIP_IMPORT_ERROR is None:
            CLIP_IMPORT_ERROR = str(exc)[:240]


ALLOWED_EXTS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".gif",
    ".tif",
    ".tiff",
    ".heic",
    ".heif",
    ".avif",
    ".jp2",
    ".j2k",
    ".jpf",
    ".jpx",
}


def _resolve_device():
    if torch is None:
        return "cpu"
    env = (os.getenv("AIREALCHECK_CLIP_DEVICE") or "").strip().lower()
    if env in {"cpu", "cuda", "mps"}:
        return env
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _load_model():
    if torch is None:
        raise RuntimeError("torch_missing")
    if not CLIP_BACKEND:
        raise RuntimeError(f"clip_library_missing:{CLIP_IMPORT_ERROR or 'missing_open_clip_or_clip'}")

    model_name = (os.getenv("AIREALCHECK_CLIP_MODEL") or "ViT-B-32").strip() or "ViT-B-32"
    pretrained = (os.getenv("AIREALCHECK_CLIP_PRETRAINED") or "openai").strip() or "openai"
    device = _resolve_device()

    if CLIP_BACKEND == "open_clip":
        out = open_clip.create_model_and_transforms(model_name, pretrained=pretrained)
        if isinstance(out, (list, tuple)) and len(out) >= 2:
            model = out[0]
            preprocess = out[-1]
        else:
            model, preprocess = out
        model = model.to(device)
    else:
        model, preprocess = openai_clip.load(model_name, device=device)

    model.eval()
    return model, preprocess, device, model_name, pretrained


def _iter_images(root):
    for base, _, files in os.walk(root):
        for name in files:
            ext = os.path.splitext(name)[1].lower()
            if ext and ext not in ALLOWED_EXTS:
                continue
            yield os.path.join(base, name)


def _encode_image(model, preprocess, image_path, device):
    if Image is None:
        raise RuntimeError("pillow_missing")
    image = Image.open(image_path).convert("RGB")
    image_input = preprocess(image).unsqueeze(0)
    image_input = image_input.to(device)
    with torch.no_grad():
        if hasattr(model, "encode_image"):
            features = model.encode_image(image_input)
        elif hasattr(model, "get_image_features"):
            features = model.get_image_features(pixel_values=image_input)
        else:
            raise RuntimeError("encode_image_missing")
    if features.ndim == 1:
        features = features.unsqueeze(0)
    features = features / features.norm(dim=-1, keepdim=True)
    return features[0].detach().cpu().numpy().astype(np.float32)


def build_embeddings(input_dir, output_path):
    if np is None:
        raise RuntimeError("numpy_missing")
    if torch is None:
        raise RuntimeError("torch_missing")
    if Image is None:
        raise RuntimeError("pillow_missing")

    if not os.path.isdir(input_dir):
        raise RuntimeError(f"input_not_found:{input_dir}")

    model, preprocess, device, model_name, pretrained = _load_model()
    backend = CLIP_BACKEND or "clip"

    images = list(_iter_images(input_dir))
    total = len(images)
    if total == 0:
        raise RuntimeError(f"no_images_found:{input_dir}")

    print(f"[clip] backend={backend} model={model_name} pretrained={pretrained} device={device}")
    print(f"[clip] images found: {total}")

    embeddings = []
    paths = []
    skipped = 0
    start = time.time()

    for idx, path in enumerate(images, start=1):
        rel_path = os.path.relpath(path, input_dir)
        try:
            emb = _encode_image(model, preprocess, path, device)
        except Exception as exc:
            skipped += 1
            print(f"[skip] {rel_path} ({str(exc)[:120]})")
            continue

        embeddings.append(emb)
        paths.append(rel_path)

        if idx == 1 or idx % 10 == 0 or idx == total:
            elapsed = time.time() - start
            print(f"[progress] {idx}/{total} processed, ok={len(embeddings)}, skipped={skipped}, {elapsed:.1f}s")

    if not embeddings:
        raise RuntimeError("no_valid_images")

    emb_array = np.stack(embeddings, axis=0).astype(np.float32)
    model_tag = f"{backend}:{model_name}:{pretrained}"

    out_dir = os.path.dirname(output_path) or "."
    os.makedirs(out_dir, exist_ok=True)
    np.savez(output_path, embeddings=emb_array, paths=np.array(paths), model=model_tag)

    print(f"[done] wrote {output_path}")
    print(f"[done] embeddings: {emb_array.shape[0]} x {emb_array.shape[1]}")
    print(f"[done] skipped: {skipped}")


def main():
    parser = argparse.ArgumentParser(description="Build CLIP embeddings for real images.")
    parser.add_argument(
        "--input",
        default=os.path.join("Assets", "Test Bilder", "Real"),
        help="Input directory with real images.",
    )
    parser.add_argument(
        "--output",
        default=os.path.join("data", "clip_real_embeddings.npz"),
        help="Output .npz path.",
    )
    args = parser.parse_args()

    try:
        build_embeddings(args.input, args.output)
    except Exception as exc:
        print(f"[error] {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
