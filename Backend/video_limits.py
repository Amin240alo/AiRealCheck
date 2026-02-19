import os


DEFAULT_MAX_VIDEO_SECONDS = 300.0
DEFAULT_VIDEO_SCAN_FPS = 2.0


def _env_float(name, default):
    try:
        return float(os.getenv(name, str(default)))
    except Exception:
        return float(default)


def _env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except Exception:
        return int(default)


def _env_bool(name, default="false"):
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


def allow_unlimited_video_seconds():
    return _env_bool("AIREALCHECK_ALLOW_UNLIMITED_VIDEO_SECONDS", "false")


def get_max_video_bytes():
    max_mb = _env_int("AIREALCHECK_MAX_VIDEO_MB", 200)
    if max_mb <= 0:
        max_mb = 200
    return max_mb * 1024 * 1024


def get_max_video_seconds():
    raw = _env_float("AIREALCHECK_MAX_VIDEO_SECONDS", 0.0)
    if raw <= 0:
        if allow_unlimited_video_seconds():
            return None
        return DEFAULT_MAX_VIDEO_SECONDS
    return raw


def get_video_scan_fps():
    value = _env_float("AIREALCHECK_VIDEO_SCAN_FPS", DEFAULT_VIDEO_SCAN_FPS)
    if value <= 0:
        return DEFAULT_VIDEO_SCAN_FPS
    return value


def get_video_max_scan_frames():
    value = _env_int("AIREALCHECK_VIDEO_MAX_SCAN_FRAMES", 0)
    if value <= 0:
        value = _env_int("AIREALCHECK_VIDEO_FRAMES_EXTRACT", 300)
    return max(0, int(value))


def get_video_duration_sec(path):
    try:
        import cv2
    except Exception:
        return None
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return None
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        total = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0
        if fps and total:
            return float(total / fps)
        return None
    finally:
        cap.release()
