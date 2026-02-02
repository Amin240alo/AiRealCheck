import os
import shutil
import subprocess
import tempfile
import time
import traceback
from statistics import mean, median
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from Backend.image_forensics import (
    _ela_score,
    _high_freq_ratio,
    _phash_distance,
    _sharpness_variance,
    _to_cv_gray,
)


def _not_available(notes="not_available"):
    return {
        "engine": "video_forensics",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": [],
        "notes": notes,
        "status": "not_available",
        "available": False,
    }


def _error(notes="error"):
    return {
        "engine": "video_forensics",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": [],
        "notes": notes,
        "status": "error",
        "available": False,
    }


def _no_frames_result(stderr_snippet=""):
    signals = ["no_frames"]
    if stderr_snippet:
        signals.append(f"ffmpeg_stderr:{stderr_snippet}")
    return {
        "engine": "video_forensics",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": signals[:6],
        "notes": "no_frames",
        "status": "ok",
        "available": True,
    }


def _clamp_file_size(path: str, max_mb: int):
    try:
        size = os.path.getsize(path)
    except Exception:
        return False
    return size <= max_mb * 1024 * 1024


def _uniform_indices(total_frames, count):
    if total_frames <= 0 or count <= 0:
        return []
    if count == 1:
        return [total_frames // 2]
    stride = (total_frames - 1) / float(count - 1)
    return sorted({int(round(i * stride)) for i in range(count)})


def _frame_to_pil(frame_bgr):
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def _downsample_gray(gray, max_width=320):
    h, w = gray.shape[:2]
    if w <= max_width:
        return gray
    scale = max_width / float(w)
    new_size = (max_width, max(1, int(round(h * scale))))
    return cv2.resize(gray, new_size, interpolation=cv2.INTER_AREA)


def _hist_gray(gray, bins=32):
    hist = cv2.calcHist([gray], [0], None, [bins], [0, 256])
    cv2.normalize(hist, hist)
    return hist


def _blockiness_score(gray):
    h, w = gray.shape[:2]
    if h < 16 or w < 16:
        return 0.0
    gray = gray.astype(np.float32)
    v_boundary = np.abs(gray[:, 7::8] - gray[:, 8::8]).mean() if w > 8 else 0.0
    h_boundary = np.abs(gray[7::8, :] - gray[8::8, :]).mean() if h > 8 else 0.0
    v_non = np.abs(gray[:, 1::8] - gray[:, 2::8]).mean() if w > 2 else 0.0
    h_non = np.abs(gray[1::8, :] - gray[2::8, :]).mean() if h > 2 else 0.0
    boundary = (v_boundary + h_boundary) * 0.5
    non_boundary = (v_non + h_non) * 0.5
    return float(boundary / (non_boundary + 1e-6))


def _residual_std(gray):
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    residual = gray.astype(np.float32) - blur.astype(np.float32)
    return float(np.std(residual))


def _mad_ratio(values):
    if not values:
        return 0.0
    med = float(np.median(values))
    if med == 0:
        return 0.0
    mad = float(np.median(np.abs(np.array(values) - med)))
    return abs(mad / med)


def _cv_ratio(values):
    if not values:
        return 0.0
    mean_val = float(np.mean(values))
    if mean_val == 0:
        return 0.0
    return float(np.std(values) / abs(mean_val))


def _select_top_indices(scores, count):
    if not scores or count <= 0:
        return []
    scores_sorted = sorted(scores, key=lambda x: x[1], reverse=True)
    return [idx for idx, _ in scores_sorted[:count]]


def _downsample_indices(indices, max_count):
    if len(indices) <= max_count:
        return indices
    if max_count <= 0:
        return []
    if max_count == 1:
        return [indices[len(indices) // 2]]
    stride = (len(indices) - 1) / float(max_count - 1)
    sampled = []
    for i in range(max_count):
        idx = int(round(i * stride))
        idx = max(0, min(len(indices) - 1, idx))
        sampled.append(indices[idx])
    return sorted(set(sampled))


def _log_debug(message: str):
    try:
        print(f"[video_forensics] {message}")
    except Exception:
        pass


_FFMPEG_PATH_LOGGED = False
_FFPROBE_PATH_LOGGED = False


def _candidate_windows_ffmpeg_paths(exe_name: str):
    localapp = os.getenv("LOCALAPPDATA") or ""
    programdata = os.getenv("PROGRAMDATA") or ""
    candidates = [
        os.path.join(localapp, "Microsoft", "WinGet", "Links", exe_name),
        os.path.join(programdata, "chocolatey", "bin", exe_name),
        os.path.join("C:\\", "ffmpeg", "bin", exe_name),
        os.path.join("C:\\", "Program Files", "ffmpeg", "bin", exe_name),
        os.path.join("C:\\", "Program Files (x86)", "ffmpeg", "bin", exe_name),
    ]
    return [p for p in candidates if p and os.path.exists(p)]


def _powershell_get_command(exe_name: str):
    try:
        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                f"(Get-Command {exe_name} -ErrorAction SilentlyContinue).Source",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=2,
            check=False,
        )
    except Exception:
        return ""
    if proc.returncode != 0:
        return ""
    output = (proc.stdout.decode("utf-8", errors="ignore") or "").strip()
    return output if output and os.path.exists(output) else ""


def _resolve_ffmpeg_path(exe_name: str):
    env_path = (os.getenv("FFMPEG_PATH") or "").strip()
    if env_path:
        if os.path.isdir(env_path):
            candidate = os.path.join(env_path, exe_name)
            if os.path.exists(candidate):
                return candidate
        if os.path.exists(env_path):
            return env_path
    which_path = shutil.which(exe_name.replace(".exe", "")) or shutil.which(exe_name)
    if which_path:
        return which_path
    ps_path = _powershell_get_command(exe_name)
    if ps_path:
        return ps_path
    candidates = _candidate_windows_ffmpeg_paths(exe_name)
    return candidates[0] if candidates else ""


def _ffmpeg_path():
    return _resolve_ffmpeg_path("ffmpeg.exe")


def _ffprobe_path():
    env_path = (os.getenv("FFMPEG_PATH") or "").strip()
    if env_path:
        base_dir = os.path.dirname(env_path) if os.path.isfile(env_path) else env_path
        candidate = os.path.join(base_dir, "ffprobe.exe")
        if os.path.exists(candidate):
            return candidate
    return _resolve_ffmpeg_path("ffprobe.exe")


def _format_cmd(cmd):
    try:
        return " ".join([f'"{c}"' if " " in str(c) else str(c) for c in cmd])
    except Exception:
        return "<unprintable>"


def _log_ffmpeg_path(path):
    global _FFMPEG_PATH_LOGGED
    if _FFMPEG_PATH_LOGGED:
        return
    _FFMPEG_PATH_LOGGED = True
    _log_debug(f"ffmpeg_path={path}")


def _log_ffprobe_path(path):
    global _FFPROBE_PATH_LOGGED
    if _FFPROBE_PATH_LOGGED:
        return
    _FFPROBE_PATH_LOGGED = True
    _log_debug(f"ffprobe_path={path}")


def log_ffmpeg_diagnostics():
    ffmpeg = _ffmpeg_path()
    ffprobe = _ffprobe_path()
    _log_ffmpeg_path(ffmpeg)
    _log_ffprobe_path(ffprobe)
    if ffmpeg and os.path.exists(ffmpeg):
        cmd = [ffmpeg, "-version"]
        _log_debug(f"ffmpeg_selftest_cmd={_format_cmd(cmd)}")
        try:
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=4,
                check=False,
            )
        except Exception as exc:
            _log_debug(f"ffmpeg_selftest_exit=error err={type(exc).__name__}")
            return
        stderr = _safe_stderr_snippet(proc.stderr.decode("utf-8", errors="ignore") if proc.stderr else "")
        _log_debug(f"ffmpeg_selftest_exit={proc.returncode} stderr='{stderr}'")
    else:
        _log_debug("ffmpeg_selftest_exit=not_found")
    selftest_video = (os.getenv("AIREALCHECK_FFMPEG_SELFTEST_VIDEO") or "").strip()
    if selftest_video and os.path.exists(selftest_video):
        frames, meta = _extract_first_frame_ffmpeg(selftest_video, 6)
        if frames and meta.get("frames_extracted_count") == 1:
            _log_debug("ffmpeg_selftest_frame=PASS")
        else:
            stderr = _safe_stderr_snippet(meta.get("stderr") or "")
            _log_debug(f"ffmpeg_selftest_frame=FAIL stderr='{stderr}'")


def _ffmpeg_available(timeout_sec=5):
    ffmpeg = _ffmpeg_path()
    _log_ffmpeg_path(ffmpeg)
    if not ffmpeg or not os.path.exists(ffmpeg):
        return False
    if not os.access(ffmpeg, os.X_OK):
        return False
    try:
        proc = subprocess.run(
            [ffmpeg, "-version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_sec,
            check=False,
        )
    except Exception:
        return False
    return proc.returncode == 0


def _safe_stderr_snippet(text: str, limit=200):
    if not isinstance(text, str):
        return ""
    snippet = text.replace("\r", " ").replace("\n", " ").strip()
    return snippet[:limit]


def _limit_note(text: str, limit=200):
    if not isinstance(text, str):
        return ""
    return text[:limit]


def _collect_frame_files(frames_dir: str):
    path = Path(frames_dir)
    patterns = ["frame-*.jpg", "frame_*.jpg", "*.jpg", "*.jpeg", "*.png"]
    files = []
    for pattern in patterns:
        files.extend(path.glob(pattern))
    unique = {}
    for item in files:
        try:
            suffix = item.suffix.lower()
        except Exception:
            continue
        if suffix not in {".jpg", ".jpeg", ".png"}:
            continue
        unique[str(item.resolve())] = item
    return [unique[key] for key in sorted(unique.keys())]


def _try_pil_open(frame_path: str):
    try:
        with Image.open(frame_path) as img:
            return img.convert("RGB"), None
    except Exception as exc:
        return None, exc


def _probe_codec_info(file_path, timeout_sec):
    ffprobe = _ffprobe_path()
    _log_ffprobe_path(ffprobe)
    if not ffprobe:
        return {"codec": None, "pix_fmt": None, "decoder": None}
    cmd = [
        ffprobe,
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,pix_fmt,codec_tag_string",
        "-of",
        "default=nokey=1:noprint_wrappers=1",
        file_path,
    ]
    _log_debug(f"ffprobe_cmd={_format_cmd(cmd)}")
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_sec,
            check=False,
        )
    except Exception:
        return {"codec": None, "pix_fmt": None, "decoder": None}

    lines = (proc.stdout.decode("utf-8", errors="ignore") or "").splitlines()
    codec = lines[0].strip() if len(lines) > 0 else None
    pix_fmt = lines[1].strip() if len(lines) > 1 else None
    decoder = None
    return {"codec": codec or None, "pix_fmt": pix_fmt or None, "decoder": decoder}


def _extract_frames_ffmpeg(file_path, max_frames, scan_fps, timeout_sec):
    ffmpeg = _ffmpeg_path()
    _log_ffmpeg_path(ffmpeg)
    if not ffmpeg or not os.path.exists(ffmpeg) or not os.access(ffmpeg, os.X_OK):
        return [], {"note": "ffmpeg_not_installed", "ffmpeg_exit": None, "stderr": ""}
    if not os.path.exists(file_path):
        return [], {"note": "file_missing", "ffmpeg_exit": None, "stderr": ""}
    try:
        if os.path.getsize(file_path) <= 0:
            return [], {"note": "file_size_0", "ffmpeg_exit": None, "stderr": ""}
    except Exception:
        return [], {"note": "file_size_0", "ffmpeg_exit": None, "stderr": ""}

    base_tmp = tempfile.gettempdir()
    os.makedirs(base_tmp, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=base_tmp) as tmpdir:
        _log_debug(f"ffmpeg_tmpdir={tmpdir}")
        out_pattern = os.path.join(tmpdir, "frame-%04d.jpg")
        vf_parts = []
        if scan_fps and scan_fps > 0:
            vf_parts.append(f"fps={scan_fps}")
        vf_parts.append("scale=trunc(iw/2)*2:trunc(ih/2)*2")
        vf = ",".join(vf_parts)
        cmd = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            file_path,
            "-an",
            "-sn",
            "-dn",
            "-vsync",
            "0",
            "-vf",
            vf,
            "-frames:v",
            str(max_frames),
            out_pattern,
        ]

        codec_info = _probe_codec_info(file_path, timeout_sec)
        codec_log = ",".join(
            [
                f"codec={codec_info.get('codec') or 'unknown'}",
                f"pix_fmt={codec_info.get('pix_fmt') or 'unknown'}",
                f"decoder={codec_info.get('decoder') or 'unknown'}",
            ]
        )
        _log_debug(f"ffmpeg_cmd={_format_cmd(cmd)}")
        _log_debug(f"ffmpeg_cmd_exit=running path={file_path} {codec_log}")
        try:
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout_sec,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            stderr = _safe_stderr_snippet(exc.stderr.decode("utf-8", errors="ignore") if exc.stderr else "")
            stdout = _safe_stderr_snippet(exc.stdout.decode("utf-8", errors="ignore") if exc.stdout else "")
            _log_debug(f"ffmpeg_cmd_exit=timeout stderr='{stderr}' stdout='{stdout}'")
            return [], {"note": "timeout", "ffmpeg_exit": None, "stderr": stderr, "stdout": stdout}
        except Exception as exc:
            _log_debug(f"ffmpeg_cmd_exit=error err={type(exc).__name__}")
            return [], {"note": "ffmpeg_error", "ffmpeg_exit": None, "stderr": ""}

        stderr = _safe_stderr_snippet(proc.stderr.decode("utf-8", errors="ignore") if proc.stderr else "")
        stdout = _safe_stderr_snippet(proc.stdout.decode("utf-8", errors="ignore") if proc.stdout else "")
        _log_debug(f"ffmpeg_cmd_exit={proc.returncode} stderr='{stderr}' stdout='{stdout}'")
        if proc.returncode != 0:
            note = f"ffmpeg_extract_failed:{stderr}" if stderr else "ffmpeg_extract_failed"
            return [], {"note": note, "ffmpeg_exit": proc.returncode, "stderr": stderr, "stdout": stdout}

        frames_dir = os.path.abspath(tmpdir)
        _log_debug(f"frames_dir={frames_dir}")
        _log_debug(f"frames_pattern={out_pattern}")
        frame_files = _collect_frame_files(frames_dir)
        frames_extracted_count = len(frame_files)
        names_preview = ", ".join([p.name for p in frame_files[:10]])
        _log_debug(f"frames_files_total={frames_extracted_count} first_10=[{names_preview}]")

        frames = []
        frame_paths = []
        for frame_path in frame_files:
            img = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
            if img is not None:
                frames.append(img)
                frame_paths.append(str(frame_path))
        _log_debug(f"frames_extracted={len(frames)}")
        if frames_extracted_count == 0:
            return [], {
                "note": "no_frames",
                "ffmpeg_exit": proc.returncode,
                "stderr": stderr,
                "stdout": stdout,
                "frames_extracted_count": 0,
            }
        return frames, {
            "note": "ok",
            "ffmpeg_exit": proc.returncode,
            "stderr": stderr,
            "stdout": stdout,
            "frames_extracted_count": frames_extracted_count,
            "frame_paths": frame_paths,
        }


def extract_video_frames(file_path, max_frames, scan_fps, timeout_sec):
    frames, meta = _extract_frames_ffmpeg(file_path, max_frames, scan_fps, timeout_sec)
    if frames:
        meta["method"] = "ffmpeg"
        return frames, meta
    if meta.get("note") == "ffmpeg_not_installed":
        _log_debug("ffmpeg_not_installed")
    elif meta.get("note"):
        _log_debug(f"ffmpeg_failed_note={meta.get('note')}")
    meta["method"] = "ffmpeg"
    return frames, meta


def _extract_frames_ffmpeg_fallback(file_path, max_frames, timeout_sec):
    ffmpeg = _ffmpeg_path()
    _log_ffmpeg_path(ffmpeg)
    if not ffmpeg or not os.path.exists(ffmpeg) or not os.access(ffmpeg, os.X_OK):
        return [], {"note": "ffmpeg_not_installed", "ffmpeg_exit": None, "stderr": ""}
    if not os.path.exists(file_path):
        return [], {"note": "file_missing", "ffmpeg_exit": None, "stderr": ""}
    try:
        if os.path.getsize(file_path) <= 0:
            return [], {"note": "file_size_0", "ffmpeg_exit": None, "stderr": ""}
    except Exception:
        return [], {"note": "file_size_0", "ffmpeg_exit": None, "stderr": ""}

    base_tmp = tempfile.gettempdir()
    os.makedirs(base_tmp, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=base_tmp) as tmpdir:
        _log_debug(f"ffmpeg_fallback_tmpdir={tmpdir}")
        out_pattern = os.path.join(tmpdir, "frame-%04d.jpg")
        cmd = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            file_path,
            "-an",
            "-sn",
            "-dn",
            "-vsync",
            "0",
            "-frames:v",
            str(max_frames),
            out_pattern,
        ]
        _log_debug(f"ffmpeg_fallback_cmd={_format_cmd(cmd)}")
        _log_debug("ffmpeg_fallback=running")
        try:
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout_sec,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            stderr = _safe_stderr_snippet(exc.stderr.decode("utf-8", errors="ignore") if exc.stderr else "")
            stdout = _safe_stderr_snippet(exc.stdout.decode("utf-8", errors="ignore") if exc.stdout else "")
            _log_debug(f"ffmpeg_fallback_exit=timeout stderr='{stderr}' stdout='{stdout}'")
            return [], {"note": "timeout", "ffmpeg_exit": None, "stderr": stderr, "stdout": stdout}
        except Exception as exc:
            _log_debug(f"ffmpeg_fallback_exit=error err={type(exc).__name__}")
            return [], {"note": "ffmpeg_error", "ffmpeg_exit": None, "stderr": ""}

        stderr = _safe_stderr_snippet(proc.stderr.decode("utf-8", errors="ignore") if proc.stderr else "")
        stdout = _safe_stderr_snippet(proc.stdout.decode("utf-8", errors="ignore") if proc.stdout else "")
        _log_debug(f"ffmpeg_fallback_exit={proc.returncode} stderr='{stderr}' stdout='{stdout}'")
        if proc.returncode != 0:
            note = f"ffmpeg_extract_failed:{stderr}" if stderr else "ffmpeg_extract_failed"
            return [], {"note": note, "ffmpeg_exit": proc.returncode, "stderr": stderr, "stdout": stdout}

        frames_dir = os.path.abspath(tmpdir)
        _log_debug(f"frames_fallback_dir={frames_dir}")
        _log_debug(f"frames_fallback_pattern={out_pattern}")
        frame_files = _collect_frame_files(frames_dir)
        frames_extracted_count = len(frame_files)
        names_preview = ", ".join([p.name for p in frame_files[:10]])
        _log_debug(f"frames_fallback_files_total={frames_extracted_count} first_10=[{names_preview}]")

        frames = []
        frame_paths = []
        for frame_path in frame_files:
            img = cv2.imread(str(frame_path), cv2.IMREAD_COLOR)
            if img is not None:
                frames.append(img)
                frame_paths.append(str(frame_path))
        _log_debug(f"frames_extracted_fallback={len(frames)}")
        if frames_extracted_count == 0:
            return [], {
                "note": "no_frames",
                "ffmpeg_exit": proc.returncode,
                "stderr": stderr,
                "stdout": stdout,
                "frames_extracted_count": 0,
            }
        return frames, {
            "note": "ok",
            "ffmpeg_exit": proc.returncode,
            "stderr": stderr,
            "stdout": stdout,
            "frames_extracted_count": frames_extracted_count,
            "frame_paths": frame_paths,
        }


def _extract_first_frame_ffmpeg(file_path, timeout_sec):
    ffmpeg = _ffmpeg_path()
    _log_ffmpeg_path(ffmpeg)
    if not ffmpeg or not os.path.exists(ffmpeg) or not os.access(ffmpeg, os.X_OK):
        return [], {"note": "ffmpeg_not_installed", "ffmpeg_exit": None, "stderr": ""}
    if not os.path.exists(file_path):
        return [], {"note": "file_missing", "ffmpeg_exit": None, "stderr": ""}
    base_tmp = tempfile.gettempdir()
    os.makedirs(base_tmp, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=base_tmp) as tmpdir:
        _log_debug(f"ffmpeg_single_tmpdir={tmpdir}")
        out_path = os.path.join(tmpdir, "frame-0001.jpg")
        cmd = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            file_path,
            "-vf",
            "select=eq(n\\,0)",
            "-frames:v",
            "1",
            out_path,
        ]
        _log_debug(f"ffmpeg_single_cmd={_format_cmd(cmd)}")
        try:
            proc = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout_sec,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            stderr = _safe_stderr_snippet(exc.stderr.decode("utf-8", errors="ignore") if exc.stderr else "")
            stdout = _safe_stderr_snippet(exc.stdout.decode("utf-8", errors="ignore") if exc.stdout else "")
            _log_debug(f"ffmpeg_single_exit=timeout stderr='{stderr}' stdout='{stdout}'")
            return [], {"note": "timeout", "ffmpeg_exit": None, "stderr": stderr, "stdout": stdout}
        except Exception as exc:
            _log_debug(f"ffmpeg_single_exit=error err={type(exc).__name__}")
            return [], {"note": "ffmpeg_error", "ffmpeg_exit": None, "stderr": ""}

        stderr = _safe_stderr_snippet(proc.stderr.decode("utf-8", errors="ignore") if proc.stderr else "")
        stdout = _safe_stderr_snippet(proc.stdout.decode("utf-8", errors="ignore") if proc.stdout else "")
        _log_debug(f"ffmpeg_single_exit={proc.returncode} stderr='{stderr}' stdout='{stdout}'")
        if proc.returncode != 0:
            note = f"ffmpeg_extract_failed:{stderr}" if stderr else "ffmpeg_extract_failed"
            return [], {"note": note, "ffmpeg_exit": proc.returncode, "stderr": stderr, "stdout": stdout}
        img = cv2.imread(out_path, cv2.IMREAD_COLOR)
        if img is None:
            return [], {
                "note": "no_frames",
                "ffmpeg_exit": proc.returncode,
                "stderr": stderr,
                "stdout": stdout,
                "frames_extracted_count": 0,
            }
        return [img], {
            "note": "ok",
            "ffmpeg_exit": proc.returncode,
            "stderr": stderr,
            "stdout": stdout,
            "frames_extracted_count": 1,
            "frame_paths": [out_path],
        }


def _video_duration_sec(file_path):
    cap = cv2.VideoCapture(file_path)
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


def run_video_forensics(file_path: str):
    max_frames = int(os.getenv("AIREALCHECK_VIDEO_MAX_FRAMES", "30"))
    uniform_count = int(os.getenv("AIREALCHECK_VIDEO_UNIFORM_FRAMES", "12"))
    scene_count = int(os.getenv("AIREALCHECK_VIDEO_SCENE_FRAMES", "8"))
    motion_count = int(os.getenv("AIREALCHECK_VIDEO_MOTION_FRAMES", "5"))
    max_scan_frames = int(os.getenv("AIREALCHECK_VIDEO_MAX_SCAN_FRAMES", "300"))
    max_seconds = float(os.getenv("AIREALCHECK_VIDEO_FRAME_TIMEOUT_SEC", "25"))
    scan_fps = float(os.getenv("AIREALCHECK_VIDEO_SCAN_FPS", "2"))
    max_mb = int(os.getenv("AIREALCHECK_VIDEO_MAX_MB", "50"))
    enable_faces = os.getenv("AIREALCHECK_VIDEO_FACE_DETECT", "true").lower() in {"1", "true", "yes"}

    exists = os.path.exists(file_path)
    size_bytes = 0
    if exists:
        try:
            size_bytes = os.path.getsize(file_path)
        except Exception:
            size_bytes = 0
    _log_debug(f"upload_path={file_path} exists={exists} size_bytes={size_bytes}")

    if not exists:
        return _not_available("file_missing")
    if size_bytes == 0:
        return _not_available("file_size_0")
    if not _clamp_file_size(file_path, max_mb):
        return _not_available("file_too_large")

    if not _ffmpeg_available():
        return {
            "engine": "video_forensics",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": [
                "install_hint:Installiere FFmpeg und setze PATH (Windows: winget install ffmpeg; danach ffmpeg -version)"
            ],
            "notes": "ffmpeg_not_installed",
            "status": "error",
            "available": False,
        }

    start = time.time()
    frames, extract_meta = extract_video_frames(
        file_path,
        max_scan_frames,
        scan_fps,
        max_seconds,
    )
    if not frames:
        note = extract_meta.get("note") or "frame_extract_failed"
        frames_extracted_count = int(extract_meta.get("frames_extracted_count") or 0)
        if note == "ffmpeg_not_installed":
            return _error("ffmpeg_decode_failed:ffmpeg_not_installed")
        if note == "file_missing":
            return _error("ffmpeg_decode_failed:file_missing")
        if note == "file_size_0":
            return _error("ffmpeg_decode_failed:file_size_0")
        stderr = extract_meta.get("stderr") or ""
        single_frames, single_meta = _extract_first_frame_ffmpeg(file_path, max_seconds)
        if single_frames:
            frames = single_frames
            extract_meta = single_meta
        else:
            single_stderr = single_meta.get("stderr") or stderr
            if note == "timeout":
                return _error("ffmpeg_decode_failed:timeout")
            if frames_extracted_count > 0:
                return _error("ffmpeg_decode_failed:frames_unreadable")
            return _no_frames_result(_safe_stderr_snippet(single_stderr))

    timed_out = False
    scene_scores = []
    motion_scores = []
    prev_gray = None
    prev_hist = None
    for idx, frame in enumerate(frames):
        if time.time() - start > max_seconds:
            timed_out = True
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray_small = _downsample_gray(gray)
        hist = _hist_gray(gray_small)
        if prev_gray is not None:
            diff = cv2.absdiff(gray_small, prev_gray)
            motion_score = float(np.mean(diff))
            motion_scores.append((idx, motion_score))
            scene_score = float(cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CHISQR))
            scene_scores.append((idx, scene_score))
        prev_gray = gray_small
        prev_hist = hist

    extracted_count = int(extract_meta.get("frames_extracted_count") or len(frames))
    total_frames = len(frames)
    uniform_idx = _uniform_indices(total_frames, uniform_count)
    scene_idx = _select_top_indices(scene_scores, scene_count)
    motion_idx = _select_top_indices(motion_scores, motion_count)

    combined = sorted(set(uniform_idx + scene_idx + motion_idx))
    if not combined and total_frames > 0:
        combined = _uniform_indices(total_frames, max_frames)

    indices = _downsample_indices(combined, max_frames)
    fallback_selected = False
    if extracted_count > 0 and not indices:
        fallback_count = min(12, extracted_count)
        indices = list(range(fallback_count))
        fallback_selected = True
    _log_debug(
        f"frame_counts extracted={extracted_count} selected={len(indices)} "
        f"fallback_selected={str(fallback_selected).lower()}"
    )

    ela_means = []
    ela_maxes = []
    sharpness = []
    hf_ratios = []
    phash_dists = []
    blockiness = []
    residual_std = []
    frames_ok = 0
    faces_found = 0

    face_cascade = None
    if enable_faces:
        try:
            cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
            if os.path.exists(cascade_path):
                face_cascade = cv2.CascadeClassifier(cascade_path)
        except Exception:
            face_cascade = None

    def _process_frame(frame, frame_path=None):
        nonlocal frames_ok, faces_found
        try:
            if frame_path:
                # Sanity-check frame decoding via PIL before analysis.
                pil, pil_err = _try_pil_open(frame_path)
                if pil_err is not None:
                    _log_debug(f"frame_pil_open_error path={frame_path} err={repr(pil_err)}")
                    _log_debug(traceback.format_exc())
                    return False
            else:
                pil = _frame_to_pil(frame)
            gray = _to_cv_gray(pil)
            ela_mean, ela_max = _ela_score(pil)
            ela_means.append(float(ela_mean))
            ela_maxes.append(float(ela_max))
            sharpness.append(float(_sharpness_variance(gray)))
            hf_ratios.append(float(_high_freq_ratio(gray)))
            phash_dists.append(float(_phash_distance(pil)))
            blockiness.append(_blockiness_score(gray))
            residual_std.append(_residual_std(gray))
            if face_cascade is not None:
                small = _downsample_gray(gray, max_width=320)
                faces = face_cascade.detectMultiScale(small, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
                if len(faces) > 0:
                    faces_found += 1
            frames_ok += 1
            return True
        except Exception as exc:
            path_info = f" path={frame_path}" if frame_path else ""
            _log_debug(f"frame_process_error{path_info} err={repr(exc)}")
            _log_debug(traceback.format_exc())
            return False

    frame_paths = extract_meta.get("frame_paths") or []
    for idx in indices:
        if time.time() - start > max_seconds:
            timed_out = True
            break
        if idx < 0 or idx >= len(frames):
            continue
        frame_path = frame_paths[idx] if idx < len(frame_paths) else None
        _process_frame(frames[idx], frame_path=frame_path)
    _log_debug(f"frames_analyzed_count={frames_ok}")

    duration_sec = _video_duration_sec(file_path)

    min_required = min(5, len(frames))
    if frames_ok == 0 and len(frames) >= min_required and not timed_out:
        _log_debug("frames_analyzed_fallback=first_frames")
        for idx in range(min_required):
            if time.time() - start > max_seconds:
                timed_out = True
                break
            _process_frame(frames[idx])
        _log_debug(f"frames_analyzed_fallback_count={frames_ok}")

    if frames_ok == 0 and len(frames) > 0:
        frames_extracted_count = int(extract_meta.get("frames_extracted_count") or len(frames))
        frames_selected_count = len(indices)
        return {
            "engine": "video_forensics",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": [
                "forensics_only",
                f"frames_extracted:{frames_extracted_count}",
                f"frames_selected:{frames_selected_count}",
                f"frames_analyzed:{frames_ok}",
            ],
            "notes": "forensics_only",
            "status": "ok",
            "available": True,
        }

    if frames_ok == 0:
        fallback_frames, fallback_meta = _extract_frames_ffmpeg_fallback(
            file_path,
            5,
            max_seconds,
        )
        if not fallback_frames:
            return _no_frames_result(_safe_stderr_snippet(fallback_meta.get("stderr") or ""))
        frames = fallback_frames
        indices = list(range(min(5, len(frames))))
        frames_ok = 0
        ela_means = []
        ela_maxes = []
        sharpness = []
        hf_ratios = []
        phash_dists = []
        blockiness = []
        residual_std = []
        faces_found = 0
        frame_paths = fallback_meta.get("frame_paths") or []
        for idx in indices:
            if time.time() - start > max_seconds:
                timed_out = True
                break
            if idx < 0 or idx >= len(frames):
                continue
            frame_path = frame_paths[idx] if idx < len(frame_paths) else None
            _process_frame(frames[idx], frame_path=frame_path)
        if frames_ok == 0:
            return _no_frames_result(_safe_stderr_snippet(fallback_meta.get("stderr") or ""))

    temporal_summary = {
        "ela_mean_cv": _cv_ratio(ela_means),
        "ela_max_cv": _cv_ratio(ela_maxes),
        "sharpness_cv": _cv_ratio(sharpness),
        "hf_cv": _cv_ratio(hf_ratios),
    }
    residual_consistency = _cv_ratio(residual_std)
    blockiness_median = float(np.median(blockiness)) if blockiness else 0.0

    risk_reasons = []
    temporal_flag = (
        temporal_summary["ela_mean_cv"] > 0.35
        or temporal_summary["ela_max_cv"] > 0.35
        or temporal_summary["sharpness_cv"] > 0.35
        or temporal_summary["hf_cv"] > 0.25
    )
    if temporal_flag:
        risk_reasons.append("high_temporal_inconsistency")
    if blockiness_median > 1.35:
        risk_reasons.append("high_blockiness")
    if residual_consistency > 0.4:
        risk_reasons.append("noise_inconsistency")

    risk_score = 0
    if temporal_flag:
        risk_score += 2
    if blockiness_median > 1.35:
        risk_score += 1
    if residual_consistency > 0.4:
        risk_score += 1

    if risk_score >= 3:
        risk_level = "high"
    elif risk_score >= 2:
        risk_level = "medium"
    else:
        risk_level = "low"

    breakdown = {
        "uniform": len([i for i in indices if i in uniform_idx]),
        "scene": len([i for i in indices if i in scene_idx]),
        "motion": len([i for i in indices if i in motion_idx]),
        "final": len(indices),
    }

    notes_parts = [
        "hint:ok",
        f"risk_level:{risk_level}",
        f"frames_analyzed:{frames_ok}",
        (
            "sampling_breakdown:"
            f"uniform={breakdown['uniform']},"
            f"scene={breakdown['scene']},"
            f"motion={breakdown['motion']},"
            f"final={breakdown['final']}"
        ),
    ]
    if risk_reasons:
        notes_parts.extend(risk_reasons[:2])
    if timed_out:
        notes_parts.append("partial_timeout")
    if fallback_selected:
        notes_parts.append("fallback_selected_first_frames")

    frames_extracted_count = int(extract_meta.get("frames_extracted_count") or len(frames))
    frames_selected_count = len(indices)

    signals = [
        f"frames_analyzed:{frames_ok}",
        f"frames_extracted:{frames_extracted_count}",
        f"frames_selected:{frames_selected_count}",
        (
            "sampling_breakdown:"
            f"uniform={breakdown['uniform']},"
            f"scene={breakdown['scene']},"
            f"motion={breakdown['motion']},"
            f"final={breakdown['final']}"
        ),
        f"duration_sec:{duration_sec:.2f}" if duration_sec is not None else "duration_sec:unknown",
        (
            "temporal_variance:"
            f"ela_mean_cv={temporal_summary['ela_mean_cv']:.2f},"
            f"ela_max_cv={temporal_summary['ela_max_cv']:.2f},"
            f"sharpness_cv={temporal_summary['sharpness_cv']:.2f},"
            f"hf_cv={temporal_summary['hf_cv']:.2f}"
        ),
        f"blockiness median={blockiness_median:.2f} mean={mean(blockiness):.2f}",
        f"noise_residual_consistency cv={residual_consistency:.2f} median={median(residual_std):.2f}",
        f"extractor:{extract_meta.get('method', 'unknown')}",
    ]
    if face_cascade is not None:
        signals.append(f"face_presence frames={faces_found}/{frames_ok}")

    return {
        "engine": "video_forensics",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": signals[:6],
        "notes": ";".join(notes_parts),
        "status": "ok",
        "available": True,
    }
