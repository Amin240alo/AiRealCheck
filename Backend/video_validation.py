import os
import time

from Backend.video_limits import (
    allow_unlimited_video_seconds,
    get_max_video_bytes,
    get_max_video_seconds,
    get_video_duration_sec,
    get_video_max_scan_frames,
    get_video_scan_fps,
)


_ERRORS = {
    "file_missing": ("Datei existiert nicht", 400),
    "file_too_large": ("Datei zu gross", 413),
    "video_too_long": ("Video zu lang", 413),
    "too_many_frames": ("Video übersteigt Frame-Limit", 413),
}


def _error_payload(code, notes=None):
    message, status = _ERRORS.get(code, ("invalid_video", 400))
    payload = {
        "ok": False,
        "status": "error",
        "code": code,
        "message": message,
        "http_status": status,
        "notes": notes or [],
    }
    return payload


def validate_video_input(file_path, max_upload_bytes=None):
    start = time.time()
    notes = []
    if not file_path or not os.path.exists(file_path):
        payload = _error_payload("file_missing", ["file_missing"])
        payload["timing_ms"] = int((time.time() - start) * 1000)
        return payload

    try:
        size_bytes = os.path.getsize(file_path)
    except Exception:
        size_bytes = 0

    max_env_bytes = get_max_video_bytes()
    max_bytes = max_env_bytes
    if isinstance(max_upload_bytes, int) and max_upload_bytes > 0:
        if max_env_bytes is None:
            max_bytes = max_upload_bytes
        else:
            max_bytes = min(max_env_bytes, max_upload_bytes)

    if max_bytes is not None and size_bytes > max_bytes:
        notes.append(f"size_bytes:{size_bytes}")
        notes.append(f"max_bytes:{max_bytes}")
        if max_upload_bytes:
            notes.append(f"max_upload_bytes:{max_upload_bytes}")
        payload = _error_payload("file_too_large", notes)
        payload["timing_ms"] = int((time.time() - start) * 1000)
        return payload

    max_seconds = get_max_video_seconds()
    duration_sec = get_video_duration_sec(file_path)
    if max_seconds is None:
        notes.append("duration_limit:disabled")
    else:
        notes.append(f"max_seconds:{max_seconds:g}")
    if duration_sec is not None:
        notes.append(f"duration_sec:{duration_sec:.2f}")
        if max_seconds is not None and duration_sec > max_seconds:
            payload = _error_payload("video_too_long", notes)
            payload["timing_ms"] = int((time.time() - start) * 1000)
            return payload

    scan_fps = get_video_scan_fps()
    max_scan_frames = get_video_max_scan_frames()
    if duration_sec is not None and scan_fps > 0 and max_scan_frames > 0:
        est_frames = int(duration_sec * scan_fps)
        notes.append(f"scan_fps:{scan_fps:g}")
        notes.append(f"max_scan_frames:{max_scan_frames}")
        notes.append(f"estimated_scan_frames:{est_frames}")
        if est_frames > max_scan_frames:
            payload = _error_payload("too_many_frames", notes)
            payload["timing_ms"] = int((time.time() - start) * 1000)
            return payload

    limits = {
        "max_upload_bytes": max_upload_bytes,
        "max_video_bytes": max_env_bytes,
        "max_video_seconds": max_seconds,
        "max_scan_fps": scan_fps,
        "max_scan_frames": max_scan_frames,
        "unlimited_seconds_allowed": allow_unlimited_video_seconds(),
    }

    return {
        "ok": True,
        "status": "ok",
        "notes": notes,
        "limits": limits,
        "size_bytes": size_bytes,
        "duration_sec": duration_sec,
        "timing_ms": int((time.time() - start) * 1000),
    }
