import os
from typing import Dict, Iterable, List, Optional, Tuple

from PIL import Image, ExifTags


_AI_HINT_KEYWORDS = [
    "midjourney",
    "stable diffusion",
    "sdxl",
    "dall-e",
    "dalle",
    "firefly",
    "generative",
    "prompt",
    "seed",
    "model",
    "comfyui",
    "automatic1111",
    "a1111",
    "civitai",
    "flux",
    "kandinsky",
    "playground",
    "leonardo",
    "runway",
    "pika",
    "luma",
    "ideogram",
    "pixart",
    "krea",
    "sora",
    "ai-generated",
    "ai generated",
]

_EXIF_FIELDS = {
    "Software",
    "Artist",
    "ImageDescription",
    "XPComment",
    "XPSubject",
    "XPKeywords",
    "XPTitle",
}

_XMP_HINT_FIELDS = [
    "xmp:CreatorTool",
    "xmp:Creator",
    "xmp:MetadataDate",
    "xmpMM:DocumentID",
    "xmpMM:OriginalDocumentID",
    "dc:creator",
    "dc:description",
    "dc:title",
    "photoshop:CreatorTool",
    "tiff:Software",
    "tiff:Artist",
    "xmp:Producer",
    "ai:prompt",
    "ai:model",
    "ai:generator",
    "ai:software",
]


def _make_result(
    signals: Optional[List[str]] = None,
    notes: str = "",
    available: bool = True,
) -> Dict:
    return {
        "engine": "watermark",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": signals or [],
        "notes": notes,
        "available": available,
    }


def _lower_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (bytes, bytearray)):
        try:
            return value.decode("utf-8", errors="ignore").lower()
        except Exception:
            return ""
    return str(value).lower()


def _find_keyword(text: str, keywords: Iterable[str]) -> Optional[str]:
    for kw in keywords:
        if kw in text:
            return kw
    return None


def _scan_pairs(pairs: Iterable[Tuple[str, str]]) -> Tuple[Optional[str], Optional[str]]:
    for key, value in pairs:
        value_l = _lower_str(value)
        if not value_l:
            continue
        kw = _find_keyword(value_l, _AI_HINT_KEYWORDS)
        if kw:
            return key, kw
    return None, None


def _extract_exif_pairs(img: Image.Image) -> List[Tuple[str, str]]:
    pairs: List[Tuple[str, str]] = []
    try:
        exif = img.getexif()
    except Exception:
        exif = None
    if not exif:
        return pairs
    for tag_id, value in exif.items():
        tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
        if tag_name in _EXIF_FIELDS:
            pairs.append((tag_name, value))
    return pairs


def _extract_png_text_chunks(img: Image.Image) -> List[Tuple[str, str]]:
    pairs: List[Tuple[str, str]] = []
    info = getattr(img, "info", {}) or {}
    for key, value in info.items():
        if isinstance(value, (str, bytes, bytearray)):
            pairs.append((f"png:{key}", value))
    return pairs


def _extract_xmp_block(asset_path: str) -> Optional[str]:
    try:
        with open(asset_path, "rb") as f:
            data = f.read()
    except Exception:
        return None
    start = data.find(b"<x:xmpmeta")
    if start == -1:
        start = data.find(b"<xmpmeta")
    if start == -1:
        return None
    end = data.find(b"</x:xmpmeta>", start)
    if end == -1:
        end = data.find(b"</xmpmeta>", start)
    if end == -1:
        end = start + 20000
    snippet = data[start:end]
    try:
        return snippet.decode("utf-8", errors="ignore")
    except Exception:
        return None


def _scan_xmp(xmp: str) -> Tuple[Optional[str], Optional[str]]:
    if not xmp:
        return None, None
    xmp_l = xmp.lower()
    kw = _find_keyword(xmp_l, _AI_HINT_KEYWORDS)
    if kw:
        return "xmp:keyword", kw
    for field in _XMP_HINT_FIELDS:
        if field.lower() in xmp_l:
            return "xmp:field", field
    return None, None


def analyze_watermark(asset_path: str) -> Dict:
    if not asset_path or not os.path.exists(asset_path):
        return _make_result(signals=["not_available"], notes="not_available", available=False)

    signals: List[str] = []
    try:
        with Image.open(asset_path) as img:
            exif_pairs = _extract_exif_pairs(img)
            key, kw = _scan_pairs(exif_pairs)
            if key and kw:
                signals.append(f"metadata_ai_hint:{key}:{kw}")

            if img.format and img.format.upper() == "PNG":
                png_pairs = _extract_png_text_chunks(img)
                key, kw = _scan_pairs(png_pairs)
                if key and kw:
                    signals.append(f"metadata_ai_hint:{key}:{kw}")
    except Exception:
        return _make_result(signals=["not_available"], notes="not_available", available=False)

    xmp = _extract_xmp_block(asset_path)
    key, kw = _scan_xmp(xmp or "")
    if key and kw:
        signals.append(f"metadata_ai_hint:{key}:{kw}")

    if signals:
        return _make_result(signals=signals[:6], notes="metadata_hint_found", available=True)

    return _make_result(signals=["no_watermark_detected"], notes="neutral", available=True)
