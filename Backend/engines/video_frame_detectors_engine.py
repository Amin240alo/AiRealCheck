import os
import subprocess
import tempfile
from pathlib import Path
from statistics import median

from Backend.engines.sightengine_engine import run_sightengine
from Backend.engines.reality_defender_engine import analyze_reality_defender
from Backend.engines.video_forensics_engine import (
    _collect_frame_files,
    _ffmpeg_path,
    _format_cmd,
    _safe_stderr_snippet,
)


def _log_debug(message: str):
    try:
        print(f"[video_frame_detectors] {message}")
    except Exception:
        pass


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _sightengine_available():
    if not _paid_apis_enabled():
        return False
    api_key = (os.getenv("SIGHTENGINE_API_KEY") or "").strip()
    if api_key:
        return True
    api_user = (os.getenv("SIGHTENGINE_API_USER") or "").strip()
    api_secret = (os.getenv("SIGHTENGINE_API_SECRET") or "").strip()
    return bool(api_user and api_secret)


def _reality_defender_available():
    if not _paid_apis_enabled():
        return False
    return bool((os.getenv("REALITY_DEFENDER_API_KEY") or "").strip())


def _uniform_indices(total_frames, count):
    if total_frames <= 0 or count <= 0:
        return []
    if count == 1:
        return [total_frames // 2]
    stride = (total_frames - 1) / float(count - 1)
    return sorted({int(round(i * stride)) for i in range(count)})


def _percentile(sorted_vals, pct):
    if not sorted_vals:
        return None
    if pct <= 0:
        return sorted_vals[0]
    if pct >= 100:
        return sorted_vals[-1]
    rank = (len(sorted_vals) - 1) * (pct / 100.0)
    lo = int(rank)
    hi = min(lo + 1, len(sorted_vals) - 1)
    frac = rank - lo
    return (sorted_vals[lo] * (1.0 - frac)) + (sorted_vals[hi] * frac)


def _iqr(values):
    if not values:
        return None
    vals = sorted(values)
    p25 = _percentile(vals, 25)
    p75 = _percentile(vals, 75)
    if p25 is None or p75 is None:
        return None
    return max(0.0, p75 - p25)


def _extract_frames_to_dir(file_path, tmpdir, max_frames, scan_fps, timeout_sec):
    ffmpeg = _ffmpeg_path()
    if not ffmpeg or not os.path.exists(ffmpeg) or not os.access(ffmpeg, os.X_OK):
        return [], {"note": "ffmpeg_not_installed", "stderr": ""}
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
    _log_debug(f"ffmpeg_cmd={_format_cmd(cmd)}")
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
        return [], {"note": "timeout", "stderr": stderr}
    except Exception as exc:
        return [], {"note": f"ffmpeg_error:{type(exc).__name__}", "stderr": ""}

    stderr = _safe_stderr_snippet(proc.stderr.decode("utf-8", errors="ignore") if proc.stderr else "")
    if proc.returncode != 0:
        note = f"ffmpeg_extract_failed:{stderr}" if stderr else "ffmpeg_extract_failed"
        return [], {"note": note, "stderr": stderr}

    frames_dir = os.path.abspath(tmpdir)
    frame_files = _collect_frame_files(frames_dir)
    _log_debug(f"frames_dir={frames_dir}")
    _log_debug(f"frames_pattern={out_pattern}")
    _log_debug(f"frames_files_total={len(frame_files)}")
    return frame_files, {"note": "ok", "stderr": stderr, "frames_extracted_count": len(frame_files)}


def run_video_frame_detectors(file_path: str) -> dict:
    if not _paid_apis_enabled():
        return {
            "engine": "video_frame_detectors",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": ["paid_apis_disabled"],
            "notes": "disabled:paid_apis_off",
            "available": False,
            "status": "disabled",
        }
    if not os.path.exists(file_path):
        return {
            "engine": "video_frame_detectors",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": [],
            "notes": "file_missing",
            "available": False,
        }

    use_sightengine = _sightengine_available()
    use_reality_defender = _reality_defender_available()
    engines_used = []
    if use_sightengine:
        engines_used.append("sightengine")
    if use_reality_defender:
        engines_used.append("reality_defender")

    if not engines_used:
        return {
            "engine": "video_frame_detectors",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": ["no_detectors"],
            "notes": "not_available",
            "available": False,
        }

    max_detector_frames = int(os.getenv("AIREALCHECK_VIDEO_MAX_DETECTOR_FRAMES", "20"))
    scan_fps = float(os.getenv("AIREALCHECK_VIDEO_SCAN_FPS", "2"))
    timeout_sec = float(os.getenv("AIREALCHECK_VIDEO_FRAME_TIMEOUT_SEC", "25"))

    base_tmp = tempfile.gettempdir()
    os.makedirs(base_tmp, exist_ok=True)

    with tempfile.TemporaryDirectory(dir=base_tmp) as tmpdir:
        extract_limit = max_detector_frames * 3
        frame_files, extract_meta = _extract_frames_to_dir(
            file_path,
            tmpdir,
            extract_limit,
            scan_fps,
            timeout_sec,
        )
        extracted_count = len(frame_files)
        if extracted_count == 0:
            note = extract_meta.get("note") or "no_frames"
            return {
                "engine": "video_frame_detectors",
                "ai_likelihood": None,
                "confidence": 0.0,
                "signals": [f"frames_extracted:0"],
                "notes": note,
                "available": False,
            }

        if extracted_count > max_detector_frames:
            keep = _uniform_indices(extracted_count, max_detector_frames)
            selected = [frame_files[i] for i in keep if 0 <= i < extracted_count]
        else:
            selected = list(frame_files)
        selected_count = len(selected)

        frame_scores = []
        failures = 0
        for frame_path in selected:
            per_frame_scores = []
            per_frame_engines = []

            if use_sightengine:
                se = run_sightengine(str(frame_path))
                if se.get("available") and isinstance(se.get("ai_likelihood"), (int, float)):
                    per_frame_scores.append(float(se.get("ai_likelihood")))
                    per_frame_engines.append("sightengine")

            if use_reality_defender:
                rd = analyze_reality_defender(str(frame_path))
                if rd.get("available") and isinstance(rd.get("ai_likelihood"), (int, float)):
                    per_frame_scores.append(float(rd.get("ai_likelihood")))
                    per_frame_engines.append("reality_defender")

            if per_frame_scores:
                frame_scores.append(median(per_frame_scores))
            else:
                failures += 1

        frames_scored = len(frame_scores)
        if frames_scored == 0:
            return {
                "engine": "video_frame_detectors",
                "ai_likelihood": None,
                "confidence": 0.0,
                "signals": [
                    f"frames_extracted:{extracted_count}",
                    f"frames_selected:{selected_count}",
                    "frames_scored:0",
                ],
                "notes": "partial",
                "available": False,
            }

        video_ai = median(frame_scores)
        variance = _iqr(frame_scores)
        if variance is None:
            variance = 0.0

        error_ratio = failures / float(selected_count) if selected_count else 1.0
        if frames_scored >= 10 and variance <= 0.1 and error_ratio <= 0.2:
            confidence_label = "high"
            confidence_value = 0.85
        elif frames_scored >= 5 and variance <= 0.2 and error_ratio <= 0.4:
            confidence_label = "medium"
            confidence_value = 0.65
        else:
            confidence_label = "low"
            confidence_value = 0.35

        notes = "ok" if failures == 0 else "partial"
        signals = [
            f"frames_extracted:{extracted_count}",
            f"frames_selected:{selected_count}",
            f"frames_scored:{frames_scored}",
            f"engines_used:{','.join(engines_used)}",
            f"median_ai:{video_ai:.3f}",
            f"variance:{variance:.3f}",
        ]

        return {
            "engine": "video_frame_detectors",
            "ai_likelihood": video_ai,
            "confidence": confidence_value,
            "signals": signals[:6],
            "notes": notes,
            "available": True,
        }
