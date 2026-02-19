import argparse
import os
import sys

from PIL import Image, ImageOps

from Backend.ensemble import run_ensemble

DEFAULT_OUT_DIR = "robust_out"
JPEG_DEFAULT_QUALITY = 90


def _preflight(path):
    if not path:
        return False, "missing_path"
    if not os.path.exists(path):
        return False, "file_missing"
    try:
        size = os.path.getsize(path)
    except Exception:
        return False, "size_error"
    if size <= 0:
        return False, "file_empty"
    return True, "ok"


def _load_image(path):
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        img.load()
        return img.copy()


def _to_rgb(img):
    if img.mode == "RGB":
        return img
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        return bg
    return img.convert("RGB")


def _save_jpeg(img, path, quality):
    rgb = _to_rgb(img)
    rgb.save(path, format="JPEG", quality=quality, optimize=True)


def _resize(img, scale):
    width, height = img.size
    new_width = max(1, int(round(width * scale)))
    new_height = max(1, int(round(height * scale)))
    return img.resize((new_width, new_height), resample=Image.LANCZOS)


def _crop_center(img, scale):
    width, height = img.size
    crop_w = max(1, int(round(width * scale)))
    crop_h = max(1, int(round(height * scale)))
    left = max(0, (width - crop_w) // 2)
    top = max(0, (height - crop_h) // 2)
    right = min(width, left + crop_w)
    bottom = min(height, top + crop_h)
    return img.crop((left, top, right, bottom))


def _transform_jpeg_reencode(img, quality):
    return img, quality


def _transform_resize_50pct(img):
    return _resize(img, 0.5), JPEG_DEFAULT_QUALITY


def _transform_crop_center_resize(img):
    cropped = _crop_center(img, 0.8)
    resized = cropped.resize(img.size, resample=Image.LANCZOS)
    return resized, JPEG_DEFAULT_QUALITY


def _transform_screenshot_simulation(img):
    down = _resize(img, 0.7)
    up = down.resize(img.size, resample=Image.BICUBIC)
    return up, 70


def _extract_engine(engine_results, name):
    for entry in engine_results or []:
        if isinstance(entry, dict) and entry.get("engine") == name:
            return entry
    return None


def _format_ai_conf(entry):
    if not entry:
        return "-"
    ai_value = entry.get("ai_likelihood")
    if ai_value is None and entry.get("engine") == "forensics":
        ai_value = entry.get("fake")
        ai_value = _normalize_ai01(ai_value)
    conf_value = entry.get("confidence")
    ai_str = "-" if ai_value is None else str(ai_value)
    if conf_value is None:
        conf_str = "-"
    else:
        try:
            conf_str = f"{float(conf_value):.2f}"
        except Exception:
            conf_str = str(conf_value)
    return f"{ai_str}/{conf_str}"


def _format_final_ai(value):
    if value is None:
        return "-"
    try:
        return f"{float(value):.3f}"
    except Exception:
        return str(value)


def _normalize_ai01(value):
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if v > 1.0:
        v = v / 100.0 if v <= 100.0 else 1.0
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = 1.0
    return v


def _disabled_engines(engine_results):
    disabled = []
    for entry in engine_results or []:
        if not isinstance(entry, dict):
            continue
        status = str(entry.get("status") or "").lower()
        notes = str(entry.get("notes") or "").lower()
        if status == "disabled" or notes.startswith("disabled"):
            name = entry.get("engine")
            if name:
                disabled.append(name)
    if not disabled:
        return "-"
    return ",".join(disabled)


def _truncate(text, limit=60):
    if text is None:
        return "-"
    s = str(text)
    if len(s) <= limit:
        return s
    return s[: max(0, limit - 3)] + "..."


def _collect_row(variant, result):
    if not isinstance(result, dict):
        return [variant, "-", "error", "-", "-", "error:invalid_result"]

    engine_results = result.get("engine_results")
    if not isinstance(engine_results, list):
        fallback = result.get("engine_results_raw")
        engine_results = fallback if isinstance(fallback, list) else []

    final_ai_value = result.get("final_ai")
    if final_ai_value is None:
        final_ai_value = _normalize_ai01(result.get("fake"))
    final_ai = _format_final_ai(final_ai_value)
    verdict = result.get("verdict") or "-"
    xception = _format_ai_conf(_extract_engine(engine_results, "xception"))
    forensics = _format_ai_conf(_extract_engine(engine_results, "forensics"))
    disabled = _truncate(_disabled_engines(engine_results))
    return [variant, final_ai, str(verdict), xception, forensics, disabled]


def _print_table(rows):
    headers = [
        "variant",
        "final_ai",
        "verdict",
        "xception ai/conf",
        "forensics ai/conf",
        "disabled",
    ]
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))
    header_line = " | ".join(headers[i].ljust(widths[i]) for i in range(len(headers)))
    sep_line = "-+-".join("-" * widths[i] for i in range(len(headers)))
    print(header_line)
    print(sep_line)
    for row in rows:
        print(" | ".join(str(row[i]).ljust(widths[i]) for i in range(len(headers))))


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Generate robust image variants and run the image ensemble on each."
    )
    parser.add_argument("path", help="Path to a local image file")
    parser.add_argument(
        "--out-dir",
        default=DEFAULT_OUT_DIR,
        help=f"Output directory for transformed images (default: {DEFAULT_OUT_DIR})",
    )
    args = parser.parse_args(argv)

    ok, reason = _preflight(args.path)
    if not ok:
        print(f"preflight: failed reason={reason}")
        return 2

    os.makedirs(args.out_dir, exist_ok=True)
    try:
        base_img = _load_image(args.path)
    except Exception as exc:
        print(f"preflight: failed reason=load_error:{type(exc).__name__}")
        return 2

    transforms = [
        ("jpeg_reencode_q90", lambda img: _transform_jpeg_reencode(img, 90)),
        ("jpeg_reencode_q70", lambda img: _transform_jpeg_reencode(img, 70)),
        ("jpeg_reencode_q50", lambda img: _transform_jpeg_reencode(img, 50)),
        ("resize_50pct", _transform_resize_50pct),
        ("crop_center_80pct_then_resize_back", _transform_crop_center_resize),
        ("screenshot_simulation", _transform_screenshot_simulation),
    ]

    base_name = os.path.splitext(os.path.basename(args.path))[0]
    rows = []

    for variant, transform in transforms:
        out_name = f"{base_name}__{variant}.jpg"
        out_path = os.path.join(args.out_dir, out_name)
        try:
            out_img, quality = transform(base_img)
            _save_jpeg(out_img, out_path, quality)
        except Exception as exc:
            rows.append(
                [
                    variant,
                    "-",
                    "error",
                    "-",
                    "-",
                    _truncate(f"error:transform:{type(exc).__name__}"),
                ]
            )
            continue

        try:
            result = run_ensemble(out_path)
        except Exception as exc:
            rows.append(
                [
                    variant,
                    "-",
                    "error",
                    "-",
                    "-",
                    _truncate(f"error:ensemble:{type(exc).__name__}"),
                ]
            )
            continue

        rows.append(_collect_row(variant, result))

    _print_table(rows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
