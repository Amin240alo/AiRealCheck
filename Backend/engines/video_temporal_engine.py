import os
import time
from statistics import median

try:
    import cv2
except Exception:
    cv2 = None
import numpy as np

from Backend.engines.video_forensics_engine import extract_video_frames
from Backend.engines.engine_utils import make_engine_result


def _clamp01(value):
    try:
        v = float(value)
    except Exception:
        return 0.0
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _iqr(values):
    if not values:
        return 0.0
    vals = sorted(values)
    mid = len(vals) // 2
    if len(vals) % 2 == 1:
        med = vals[mid]
    else:
        med = (vals[mid - 1] + vals[mid]) / 2.0
    q1 = vals[len(vals) // 4]
    q3 = vals[(len(vals) * 3) // 4]
    return max(0.0, float(q3 - q1)) if med is not None else 0.0


def _cv_ratio(values):
    if not values:
        return 0.0
    mean_val = float(np.mean(values))
    if mean_val == 0.0:
        return 0.0
    return float(np.std(values) / abs(mean_val))


def _downsample_gray(gray, max_width=320):
    h, w = gray.shape[:2]
    if w <= max_width:
        return gray
    scale = max_width / float(w)
    new_size = (max_width, max(1, int(round(h * scale))))
    return cv2.resize(gray, new_size, interpolation=cv2.INTER_AREA)


def _uniform_indices(total_frames, count):
    if total_frames <= 0 or count <= 0:
        return []
    if count == 1:
        return [total_frames // 2]
    stride = (total_frames - 1) / float(count - 1)
    return sorted({int(round(i * stride)) for i in range(count)})


def _extract_frames_cv2(file_path, max_frames):
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        return [], {"note": "cv2_open_failed"}
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total > 0:
            indices = _uniform_indices(total, max_frames)
            frames = []
            for idx in indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ok, frame = cap.read()
                if ok and frame is not None:
                    frames.append(frame)
            return frames, {"note": "ok", "method": "cv2", "frames_extracted_count": len(frames)}
        frames = []
        while len(frames) < max_frames:
            ok, frame = cap.read()
            if not ok or frame is None:
                break
            frames.append(frame)
        return frames, {"note": "ok", "method": "cv2", "frames_extracted_count": len(frames)}
    finally:
        cap.release()


def _insufficient_frames_result(frames_extracted, extractor, start_time=None):
    signals = [
        f"frames_extracted:{frames_extracted}",
        f"extractor:{extractor}",
    ]
    return make_engine_result(
        engine="video_temporal",
        status="not_available",
        notes="insufficient_frames",
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=signals[:6],
        start_time=start_time,
    )


def run_video_temporal(file_path: str) -> dict:
    start_time = time.time()
    if cv2 is None:
        return make_engine_result(
            engine="video_temporal",
            status="not_available",
            notes="opencv_missing",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["not_available"],
            start_time=start_time,
        )
    max_frames = int(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_MAX_FRAMES", "12"))
    scan_fps = float(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_SCAN_FPS", "1.0"))
    timeout_sec = float(os.getenv("AIREALCHECK_VIDEO_TEMPORAL_TIMEOUT_SEC", "15"))

    if not os.path.exists(file_path):
        return make_engine_result(
            engine="video_temporal",
            status="not_available",
            notes="file_missing",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["file_missing"],
            start_time=start_time,
        )

    start = time.time()
    frames_raw, meta = extract_video_frames(file_path, max_frames, scan_fps, timeout_sec)
    extractor = meta.get("method", "ffmpeg")
    if not frames_raw:
        frames_raw, meta = _extract_frames_cv2(file_path, max_frames)
        extractor = meta.get("method", "cv2")

    frame_items = []
    for item in frames_raw or []:
        if isinstance(item, dict):
            if item.get("frame") is None and item.get("path") is None:
                continue
            frame_items.append(item)
        elif isinstance(item, (str, os.PathLike)):
            frame_items.append({"path": str(item)})
        else:
            frame_items.append({"frame": item})

    frames_extracted = int(meta.get("frames_extracted_count") or len(frame_items))
    if len(frame_items) < 4:
        return _insufficient_frames_result(frames_extracted, extractor, start_time=start_time)

    flow_mags = []
    residuals = []
    hf_vars = []
    frames_ok = 0
    prev_gray = None

    for item in frame_items:
        if time.time() - start > timeout_sec:
            break
        try:
            img = None
            if isinstance(item, dict):
                if item.get("frame") is not None:
                    img = item.get("frame")
                elif item.get("path"):
                    img = cv2.imread(str(item.get("path")))
            elif isinstance(item, (str, os.PathLike)):
                img = cv2.imread(str(item))
            else:
                img = item
            if img is None:
                continue
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray_small = _downsample_gray(gray)
            lap = cv2.Laplacian(gray_small, cv2.CV_32F)
            hf_vars.append(float(np.var(lap)))
            if prev_gray is not None:
                flow = cv2.calcOpticalFlowFarneback(
                    prev_gray,
                    gray_small,
                    None,
                    0.5,
                    3,
                    15,
                    3,
                    5,
                    1.2,
                    0,
                )
                mag = np.sqrt((flow[..., 0] ** 2) + (flow[..., 1] ** 2))
                flow_mags.append(float(np.median(mag)))
                residuals.append(
                    float(np.mean(np.abs(gray_small.astype(np.float32) - prev_gray.astype(np.float32))))
                )
            prev_gray = gray_small
            frames_ok += 1
        except Exception:
            continue

    if frames_ok < 4 or not flow_mags:
        return _insufficient_frames_result(frames_extracted, extractor, start_time=start_time)

    flow_median = float(np.median(flow_mags)) if flow_mags else 0.0
    flow_iqr = _iqr(flow_mags)
    residual_mean = float(np.mean(residuals)) if residuals else 0.0
    hf_cv = _cv_ratio(hf_vars)

    flow_score = max(_clamp01(flow_median / 2.0), _clamp01(flow_iqr / 1.0))
    residual_score = _clamp01(residual_mean / 20.0)
    hf_score = _clamp01(hf_cv / 0.6)

    baseline = 0.15 + (0.35 * flow_score) + (0.25 * residual_score) + (0.25 * hf_score)
    ai_likelihood = _clamp01(min(baseline, 0.85))

    if frames_ok >= 8:
        confidence = 0.5
    elif frames_ok >= 5:
        confidence = 0.4
    else:
        confidence = 0.3

    signals = [
        f"frames_analyzed:{frames_ok}",
        f"frames_extracted:{frames_extracted}",
        f"flow_median:{flow_median:.3f}",
        f"flow_iqr:{flow_iqr:.3f}",
        f"residual_mean:{residual_mean:.3f}",
        f"hf_cv:{hf_cv:.3f}",
        f"extractor:{extractor}",
    ]

    return make_engine_result(
        engine="video_temporal",
        status="ok",
        notes="ok",
        available=True,
        ai_likelihood=ai_likelihood,
        confidence=confidence,
        signals=signals[:6],
        start_time=start_time,
    )
