import os
import shutil
import subprocess
import tempfile
import time
from statistics import mean, median

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


def _safe_stderr_snippet(text: str, limit=200):
    if not isinstance(text, str):
        return ""
    snippet = text.replace("\r", " ").replace("\n", " ").strip()
    return snippet[:limit]


def _limit_note(text: str, limit=200):
    if not isinstance(text, str):
        return ""
    return text[:limit]


def _extract_frames_ffmpeg(file_path, max_frames, scan_fps, timeout_sec):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return [], {"note": "ffmpeg_not_installed", "ffmpeg_exit": None, "stderr": ""}

    with tempfile.TemporaryDirectory() as tmpdir:
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

        _log_debug(f"ffmpeg_cmd_exit=running path={file_path}")
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
            _log_debug(f"ffmpeg_cmd_exit=timeout stderr='{stderr}'")
            return [], {"note": "timeout", "ffmpeg_exit": None, "stderr": stderr}
        except Exception as exc:
            _log_debug(f"ffmpeg_cmd_exit=error err={type(exc).__name__}")
            return [], {"note": "ffmpeg_error", "ffmpeg_exit": None, "stderr": ""}

        stderr = _safe_stderr_snippet(proc.stderr.decode("utf-8", errors="ignore") if proc.stderr else "")
        _log_debug(f"ffmpeg_cmd_exit={proc.returncode} stderr='{stderr}'")
        if proc.returncode != 0:
            note = f"ffmpeg_extract_failed:{stderr}" if stderr else "ffmpeg_extract_failed"
            return [], {"note": note, "ffmpeg_exit": proc.returncode, "stderr": stderr}

        frames = []
        for name in sorted(os.listdir(tmpdir)):
            if not name.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            frame_path = os.path.join(tmpdir, name)
            img = cv2.imread(frame_path, cv2.IMREAD_COLOR)
            if img is not None:
                frames.append(img)
        return frames, {"note": "ok", "ffmpeg_exit": proc.returncode, "stderr": stderr}


def _extract_frames_opencv(file_path, max_frames, scan_fps, timeout_sec):
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        return [], {"note": "video_open_failed"}
    frames = []
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        step = 1
        if scan_fps and scan_fps > 0 and fps and fps > 0:
            step = max(1, int(round(fps / scan_fps)))
        frame_idx = 0
        start = time.time()
        while len(frames) < max_frames:
            if time.time() - start > timeout_sec:
                return frames, {"note": "timeout"}
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            if frame_idx % step == 0:
                frames.append(frame)
            frame_idx += 1
        return frames, {"note": "ok"}
    finally:
        cap.release()


def extract_video_frames(file_path, max_frames, scan_fps, timeout_sec):
    frames, meta = _extract_frames_ffmpeg(file_path, max_frames, scan_fps, timeout_sec)
    if frames:
        meta["method"] = "ffmpeg"
        return frames, meta
    if meta.get("note") == "ffmpeg_not_installed":
        _log_debug("ffmpeg_not_installed")
    elif meta.get("note"):
        _log_debug(f"ffmpeg_failed_note={meta.get('note')}")

    frames, meta_cv = _extract_frames_opencv(file_path, max_frames, scan_fps, timeout_sec)
    meta_cv["method"] = "opencv"
    if not frames:
        ffmpeg_note = meta.get("note")
        if ffmpeg_note == "timeout":
            meta_cv["note"] = "timeout"
        elif isinstance(ffmpeg_note, str) and ffmpeg_note.startswith("ffmpeg_extract_failed"):
            meta_cv["note"] = ffmpeg_note
        elif ffmpeg_note in {"ffmpeg_error", "ffmpeg_not_installed"} and meta_cv.get("note") != "ok":
            meta_cv["note"] = ffmpeg_note
    return frames, meta_cv


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

    start = time.time()
    frames, extract_meta = extract_video_frames(
        file_path,
        max_scan_frames,
        scan_fps,
        max_seconds,
    )
    if not frames:
        note = extract_meta.get("note") or "frame_extract_failed"
        if note == "timeout":
            return _error("frame_extract_failed:timeout")
        if note == "ffmpeg_not_installed":
            return _error("frame_extract_failed:ffmpeg_not_installed")
        return _error(_limit_note(f"frame_extract_failed:{note}"))

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

    total_frames = len(frames)
    uniform_idx = _uniform_indices(total_frames, uniform_count)
    scene_idx = _select_top_indices(scene_scores, scene_count)
    motion_idx = _select_top_indices(motion_scores, motion_count)

    combined = sorted(set(uniform_idx + scene_idx + motion_idx))
    if not combined and total_frames > 0:
        combined = _uniform_indices(total_frames, max_frames)

    indices = _downsample_indices(combined, max_frames)

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

    def _process_frame(frame):
        nonlocal frames_ok, faces_found
        try:
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
        except Exception:
            return False

    for idx in indices:
        if time.time() - start > max_seconds:
            timed_out = True
            break
        if idx < 0 or idx >= len(frames):
            continue
        _process_frame(frames[idx])

    duration_sec = _video_duration_sec(file_path)

    if frames_ok == 0:
        breakdown = {
            "uniform": 0,
            "scene": 0,
            "motion": 0,
            "final": 0,
        }
        signals = [
            "frames_analyzed:0",
            (
                "sampling_breakdown:"
                f"uniform={breakdown['uniform']},"
                f"scene={breakdown['scene']},"
                f"motion={breakdown['motion']},"
                f"final={breakdown['final']}"
            ),
        ]
        if duration_sec is not None:
            signals.append(f"duration_sec:{duration_sec:.2f}")
        return {
            "engine": "video_forensics",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": signals[:6],
            "notes": "no_frames",
            "status": "ok",
            "available": True,
        }

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

    breakdown = {
        "uniform": len([i for i in indices if i in uniform_idx]),
        "scene": len([i for i in indices if i in scene_idx]),
        "motion": len([i for i in indices if i in motion_idx]),
        "final": len(indices),
    }

    signals = [
        f"frames_analyzed:{frames_ok}",
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
