import os
import subprocess
import tempfile
import time
from pathlib import Path
from statistics import mean, median

import numpy as np
from PIL import Image, ImageStat

try:
    import cv2
except Exception:
    cv2 = None

try:
    import imagehash
except Exception:
    imagehash = None

from Backend.engines.sightengine_engine import run_sightengine
from Backend.engines.reality_defender_engine import analyze_reality_defender
from Backend.engines.hive_engine import run_hive
from Backend.engines.video_forensics_engine import (
    _collect_frame_files,
    _ffmpeg_path,
    _format_cmd,
    _safe_stderr_snippet,
)
from Backend.engines.engine_utils import make_engine_result, coerce_engine_result


def _log_debug(message: str):
    try:
        print(f"[video_frame_detectors] {message}")
    except Exception:
        pass


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _flag_enabled(name, default="false"):
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


def _reality_defender_status():
    if not _flag_enabled("AIREALCHECK_ENABLE_REALITY_DEFENDER_VIDEO", "false"):
        return False, "disabled:flag_off", "disabled"
    if not _paid_apis_enabled():
        return False, "disabled:paid_apis_off", "disabled"
    if not (os.getenv("REALITY_DEFENDER_API_KEY") or "").strip():
        return False, "not_available:missing_key", "not_available"
    return True, "ok", "ok"


def _hive_status():
    if not _flag_enabled("AIREALCHECK_ENABLE_HIVE_VIDEO", "false"):
        return False, "disabled:flag_off", "disabled"
    if not _paid_apis_enabled():
        return False, "disabled:paid_apis_off", "disabled"
    key = (os.getenv("HIVE_API_KEY") or "").strip()
    key_id = (os.getenv("HIVE_API_KEY_ID") or "").strip()
    key_secret = (os.getenv("HIVE_API_SECRET") or "").strip()
    if not key and (not key_id or not key_secret):
        return False, "not_available:missing_key", "not_available"
    return True, "ok", "ok"


def _sensity_status():
    if not _flag_enabled("AIREALCHECK_ENABLE_SENSITY_VIDEO", "false"):
        return False, "disabled:flag_off", "disabled"
    if not _paid_apis_enabled():
        return False, "disabled:paid_apis_off", "disabled"
    if not (os.getenv("SENSITY_API_KEY") or "").strip():
        return False, "not_available:missing_key", "not_available"
    return True, "ok", "ok"


def _sightengine_creds_present():
    api_key = (os.getenv("SIGHTENGINE_API_KEY") or "").strip()
    if api_key:
        return True
    api_user = (os.getenv("SIGHTENGINE_API_USER") or "").strip()
    api_secret = (os.getenv("SIGHTENGINE_API_SECRET") or "").strip()
    return bool(api_user and api_secret)


def _sightengine_status():
    if not _flag_enabled("AIREALCHECK_ENABLE_SIGHTENGINE_VIDEO", "false"):
        return False, "disabled:flag_off", "disabled"
    if not _paid_apis_enabled():
        return False, "disabled:paid_apis_off", "disabled"
    if not _sightengine_creds_present():
        return False, "not_available:missing_key", "not_available"
    return True, "ok", "ok"


def _sightengine_available():
    ok, _notes, _status = _sightengine_status()
    return ok


def _reality_defender_available():
    ok, _notes, _status = _reality_defender_status()
    return ok


def _sensity_available():
    ok, _notes, _status = _sensity_status()
    return ok


def _hive_available():
    ok, _notes, _status = _hive_status()
    return ok


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


def _env_bool(name, default="false"):
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


def _env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except Exception:
        return int(default)


def _env_float(name, default):
    try:
        return float(os.getenv(name, str(default)))
    except Exception:
        return float(default)


def _p(path):
    if path is None:
        return ""
    try:
        return str(path)
    except Exception:
        return ""


def _trimmed_mean(values, trim_ratio):
    if not values:
        return None
    vals = sorted(values)
    n = len(vals)
    if trim_ratio <= 0:
        return mean(vals)
    k = int(n * float(trim_ratio))
    if k * 2 >= n:
        return mean(vals)
    return mean(vals[k : n - k])


def _resolve_frame_selection_config():
    selected_target = _env_int(
        "AIREALCHECK_VIDEO_FRAMES_SELECTED",
        _env_int(
            "AIREALCHECK_VIDEO_DETECTOR_MAX_FRAMES",
            _env_int("AIREALCHECK_VIDEO_MAX_DETECTOR_FRAMES", 12),
        ),
    )
    extract_limit = _env_int("AIREALCHECK_VIDEO_FRAMES_EXTRACT", 40)
    if extract_limit < selected_target:
        extract_limit = selected_target
    brightness_min = max(0, min(255, _env_int("AIREALCHECK_VIDEO_BRIGHTNESS_MIN", 20)))
    brightness_max = max(0, min(255, _env_int("AIREALCHECK_VIDEO_BRIGHTNESS_MAX", 235)))
    if brightness_min > brightness_max:
        brightness_min, brightness_max = brightness_max, brightness_min
    blur_min = _env_float("AIREALCHECK_VIDEO_BLUR_MIN", 60.0)
    dedup_enabled = _env_bool("AIREALCHECK_VIDEO_DEDUP", "true")
    return {
        "selected_target": max(0, selected_target),
        "extract_limit": max(1, extract_limit),
        "brightness_min": brightness_min,
        "brightness_max": brightness_max,
        "blur_min": max(0.0, blur_min),
        "dedup_enabled": dedup_enabled,
    }


def _resolve_frame_strategy():
    strategy = (os.getenv("VIDEO_FRAME_STRATEGY") or os.getenv("AIREALCHECK_VIDEO_FRAME_STRATEGY") or "uniform").strip()
    strategy = strategy.lower()
    if strategy not in {"uniform", "scene", "smart"}:
        strategy = "uniform"
    return strategy


def _resolve_engine_frame_limits(default_sightengine):
    limits = {
        "sightengine": _env_int("VIDEO_FRAMES_SIGHTENGINE", default_sightengine),
        "hive": _env_int("VIDEO_FRAMES_HIVE", default_sightengine),
        "reality_defender": _env_int("VIDEO_FRAMES_RD", _env_int("AIREALCHECK_VIDEO_RD_MAX_FRAMES", 2)),
        "sensity": _env_int("VIDEO_FRAMES_SENSITY", 2),
        "local": _env_int("VIDEO_FRAMES_LOCAL", 12),
    }
    for key, value in list(limits.items()):
        if value < 0:
            limits[key] = 0
    return limits


def _apply_engine_availability(limits, use_sightengine, use_hive, use_reality_defender, use_sensity):
    adjusted = dict(limits)
    if not use_sightengine:
        adjusted["sightengine"] = 0
    if not use_hive:
        adjusted["hive"] = 0
    if not use_reality_defender:
        adjusted["reality_defender"] = 0
    if not use_sensity:
        adjusted["sensity"] = 0
    return adjusted


def _ensure_master_frame_target(selection_config, limits, active_engines):
    target = selection_config.get("selected_target", 0)
    for engine in active_engines:
        target = max(target, int(limits.get(engine, 0)))
    updated = dict(selection_config)
    updated["selected_target"] = max(0, int(target))
    if updated.get("extract_limit", 0) < updated["selected_target"]:
        updated["extract_limit"] = updated["selected_target"]
    return updated


def _brightness_quality(brightness):
    if brightness is None:
        return 0.0
    return max(0.0, 1.0 - abs(float(brightness) - 128.0) / 128.0)


def _quality_score(brightness, blur_value, blur_min):
    brightness_score = _brightness_quality(brightness)
    if blur_value is None or blur_min <= 0:
        return brightness_score
    blur_score = min(1.0, float(blur_value) / max(1.0, blur_min * 2.0))
    return (0.6 * brightness_score) + (0.4 * blur_score)


def _analyze_frame_file(frame_path, idx, blur_enabled, dedup_enabled, use_phash, blur_min):
    try:
        with Image.open(frame_path) as img:
            img = img.convert("RGB")
            gray = img.convert("L")
            stat = ImageStat.Stat(gray)
            brightness = float(stat.mean[0]) if stat.mean else None
            gray_np = None
            blur_value = None
            if blur_enabled or (dedup_enabled and not use_phash):
                gray_np = np.array(gray)
            if blur_enabled and gray_np is not None:
                blur_value = float(cv2.Laplacian(gray_np, cv2.CV_64F).var())
            phash_value = imagehash.phash(img) if use_phash else None
            mse_array = None
            if dedup_enabled and not use_phash:
                small = gray.resize((32, 32), Image.BILINEAR)
                mse_array = np.array(small, dtype=np.float32)
            quality = _quality_score(brightness, blur_value, blur_min)
            return {
                "index": idx,
                "path": _p(frame_path),
                "brightness": brightness,
                "blur": blur_value,
                "phash": phash_value,
                "mse_array": mse_array,
                "quality": quality,
            }
    except Exception:
        return None


def _apply_quality_filters(infos, brightness_min, brightness_max, blur_min, blur_enabled):
    filtered = []
    for info in infos:
        brightness = info.get("brightness")
        if brightness is None or brightness < brightness_min or brightness > brightness_max:
            continue
        if blur_enabled:
            blur_value = info.get("blur")
            if blur_value is None or blur_value < blur_min:
                continue
        filtered.append(info)
    return filtered


def _dedup_phash(infos, threshold=6):
    kept = []
    hashes = []
    for info in infos:
        ph = info.get("phash")
        if ph is None:
            kept.append(info)
            hashes.append(None)
            continue
        duplicate = False
        for other in hashes:
            if other is None:
                continue
            try:
                dist = ph - other
            except Exception:
                dist = None
            if dist is not None and dist <= threshold:
                duplicate = True
                break
        if not duplicate:
            kept.append(info)
            hashes.append(ph)
    return kept


def _dedup_mse(infos, threshold=0.01):
    kept = []
    arrays = []
    for info in infos:
        arr = info.get("mse_array")
        if arr is None:
            kept.append(info)
            arrays.append(None)
            continue
        duplicate = False
        for other in arrays:
            if other is None:
                continue
            diff = arr - other
            mse = float(np.mean(diff * diff)) / (255.0 * 255.0)
            if mse <= threshold:
                duplicate = True
                break
        if not duplicate:
            kept.append(info)
            arrays.append(arr)
    return kept


def _select_diverse_frames(infos, target):
    if target <= 0 or not infos:
        return []
    ordered = sorted(infos, key=lambda x: x["index"])
    if len(ordered) <= target:
        return ordered
    if target == 1:
        return [ordered[len(ordered) // 2]]
    total = len(ordered)
    picks = []
    for i in range(target):
        start = int(round(i * total / target))
        end = int(round((i + 1) * total / target))
        if end <= start:
            end = min(total, start + 1)
        bucket = ordered[start:end]
        pick = max(bucket, key=lambda x: x.get("quality", 0.0))
        picks.append(pick)
    unique = {info["index"]: info for info in picks}
    if len(unique) < target:
        remaining = [info for info in ordered if info["index"] not in unique]
        remaining_sorted = sorted(remaining, key=lambda x: x.get("quality", 0.0), reverse=True)
        for info in remaining_sorted:
            if len(unique) >= target:
                break
            unique[info["index"]] = info
    return [unique[idx] for idx in sorted(unique)]


def _build_selection_signals(meta):
    signals = [
        f"frames_extracted:{meta.get('frames_extracted', 0)}",
        f"frames_after_filters:{meta.get('frames_after_filters', 0)}",
        f"frames_selected:{meta.get('frames_selected', 0)}",
        f"selection_method:{meta.get('selection_method', 'unknown')}",
        f"dedup:{'on' if meta.get('dedup_enabled') else 'off'}",
        f"brightness:{meta.get('brightness_min')}-{meta.get('brightness_max')}",
    ]
    if meta.get("blur_filter") == "skipped_no_cv2":
        signals.append("blur_filter:skipped_no_cv2")
    elif meta.get("blur_filter") == "disabled":
        signals.append("blur_filter:disabled")
    else:
        signals.append(f"blur_filter:min={meta.get('blur_min')}")
    if meta.get("dedup_method"):
        signals.append(f"dedup_method:{meta.get('dedup_method')}")
    if meta.get("filter_fallback"):
        signals.append("filter_fallback:unfiltered")
    return signals


def _select_frames_for_scoring(frame_files, config):
    extracted_count = len(frame_files)
    blur_enabled = cv2 is not None and config.get("blur_min", 0.0) > 0
    use_phash = imagehash is not None
    infos = []
    for idx, frame_path in enumerate(frame_files):
        info = _analyze_frame_file(
            frame_path,
            idx,
            blur_enabled,
            config.get("dedup_enabled", True),
            use_phash,
            config.get("blur_min", 0.0),
        )
        if info:
            info["path"] = _p(info.get("path"))
            infos.append(info)
    filtered = _apply_quality_filters(
        infos,
        config.get("brightness_min", 0),
        config.get("brightness_max", 255),
        config.get("blur_min", 0.0),
        blur_enabled,
    )
    after_filters = len(filtered)
    filter_fallback = False
    if after_filters == 0 and infos:
        filtered = list(infos)
        filter_fallback = True

    dedup_method = None
    if config.get("dedup_enabled", True):
        if use_phash:
            filtered = _dedup_phash(filtered)
            dedup_method = "phash"
        else:
            filtered = _dedup_mse(filtered)
            dedup_method = "mse"

    selection_method = "all" if len(filtered) <= config.get("selected_target", 0) else "quality_stratified"
    selected = _select_diverse_frames(filtered, config.get("selected_target", 0))
    if not selected and infos:
        selected = _select_diverse_frames(infos, min(len(infos), config.get("selected_target", 0)))
        filter_fallback = True
        if selection_method == "quality_stratified":
            selection_method = "quality_stratified_fallback"

    if cv2 is None:
        blur_filter_status = "skipped_no_cv2"
    elif config.get("blur_min", 0.0) <= 0:
        blur_filter_status = "disabled"
    else:
        blur_filter_status = "ok"

    meta = {
        "frames_extracted": extracted_count,
        "frames_after_filters": after_filters,
        "frames_selected": len(selected),
        "selection_method": selection_method,
        "dedup_enabled": bool(config.get("dedup_enabled", True)),
        "dedup_method": dedup_method,
        "brightness_min": config.get("brightness_min", 0),
        "brightness_max": config.get("brightness_max", 255),
        "blur_min": config.get("blur_min", 0.0),
        "blur_filter": blur_filter_status,
        "filter_fallback": filter_fallback,
    }
    return selected, meta, _build_selection_signals(meta)


def _allocate_frames_by_strategy(selected_infos, count, strategy):
    if count <= 0 or not selected_infos:
        return []
    count = min(int(count), len(selected_infos))
    if count <= 0:
        return []
    if strategy == "scene":
        return _select_diverse_frames(selected_infos, count)
    if strategy == "smart":
        def _coerce_float(value):
            try:
                return float(value)
            except Exception:
                return None

        variance_values = []
        motion_values = []
        for info in selected_infos:
            variance_raw = _coerce_float(info.get("variance"))
            if variance_raw is None:
                variance_raw = _coerce_float(info.get("blur"))
            if variance_raw is not None:
                variance_values.append(variance_raw)
            motion_raw = _coerce_float(info.get("motion"))
            if motion_raw is None:
                motion_raw = _coerce_float(info.get("motion_score"))
            if motion_raw is not None:
                motion_values.append(motion_raw)

        max_variance = max(variance_values) if variance_values else None
        max_motion = max(motion_values) if motion_values else None

        def _smart_score(info):
            quality = _coerce_float(info.get("quality")) or 0.0
            variance_raw = _coerce_float(info.get("variance"))
            if variance_raw is None:
                variance_raw = _coerce_float(info.get("blur"))
            motion_raw = _coerce_float(info.get("motion"))
            if motion_raw is None:
                motion_raw = _coerce_float(info.get("motion_score"))

            variance_norm = None
            if variance_raw is not None and max_variance and max_variance > 0:
                variance_norm = variance_raw / max_variance
            motion_norm = None
            if motion_raw is not None and max_motion and max_motion > 0:
                motion_norm = motion_raw / max_motion

            if variance_norm is None and motion_norm is None:
                return quality

            quality_weighted = quality
            variance_weighted = (
                0.20 * max(0.0, min(1.0, variance_norm)) if variance_norm is not None else 0.0
            )
            motion_weighted = (
                0.20 * max(0.0, min(1.0, motion_norm)) if motion_norm is not None else 0.0
            )
            return quality_weighted + variance_weighted + motion_weighted

        ordered = sorted(
            selected_infos,
            key=lambda x: (-_smart_score(x), int(x.get("index", 0))),
        )
        picks = ordered[:count]
        return sorted(picks, key=lambda x: (int(x.get("index", 0)), _p(x.get("path"))))
    indices = _uniform_indices(len(selected_infos), count)
    return [selected_infos[i] for i in indices if 0 <= i < len(selected_infos)]


def _allocate_engine_frames(selected_infos, limits, strategy):
    return {
        "sightengine": _allocate_frames_by_strategy(selected_infos, limits.get("sightengine", 0), strategy),
        "hive": _allocate_frames_by_strategy(selected_infos, limits.get("hive", 0), strategy),
        "reality_defender": _allocate_frames_by_strategy(selected_infos, limits.get("reality_defender", 0), "smart"),
        "sensity": _allocate_frames_by_strategy(selected_infos, limits.get("sensity", 0), "smart"),
        "local": _allocate_frames_by_strategy(selected_infos, limits.get("local", 0), strategy),
    }


def _collect_scoring_frames(engine_frames, engine_names):
    by_path = {}
    for engine in engine_names:
        for info in engine_frames.get(engine, []):
            path = _p(info.get("path"))
            if not path:
                continue
            info["path"] = path
            by_path[path] = info
    return sorted(by_path.values(), key=lambda x: (int(x.get("index", 0)), _p(x.get("path"))))


def extract_and_select_video_frames(file_path: str) -> dict:
    config = _resolve_frame_selection_config()
    scan_fps = _env_float("AIREALCHECK_VIDEO_DETECTOR_SCAN_FPS", _env_float("AIREALCHECK_VIDEO_SCAN_FPS", 1.5))
    timeout_sec = _env_float(
        "AIREALCHECK_VIDEO_DETECTOR_TIMEOUT_SEC",
        _env_float("AIREALCHECK_VIDEO_FRAME_TIMEOUT_SEC", 20),
    )
    base_tmp = tempfile.gettempdir()
    os.makedirs(base_tmp, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=base_tmp) as tmpdir:
        frame_files, extract_meta = _extract_frames_to_dir(
            file_path,
            tmpdir,
            config["extract_limit"],
            scan_fps,
            timeout_sec,
        )
        selected, meta, signals = _select_frames_for_scoring(frame_files, config)
        meta["signals"] = signals
        meta["note"] = extract_meta.get("note") if isinstance(extract_meta, dict) else None
        return meta


def _extract_master_frame_candidates(file_path, tmpdir, selection_config, scan_fps, timeout_sec):
    frame_files, extract_meta = _extract_frames_to_dir(
        file_path,
        tmpdir,
        selection_config["extract_limit"],
        scan_fps,
        timeout_sec,
    )
    selected_infos, selection_meta, selection_signals = _select_frames_for_scoring(frame_files, selection_config)
    return selected_infos, selection_meta, selection_signals, extract_meta


def _rd_timeout_result():
    return make_engine_result(
        engine="reality_defender_video",
        status="timeout",
        notes="timeout",
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=["timeout"],
    )


def _rd_skipped_result(reason="skipped"):
    return make_engine_result(
        engine="reality_defender_video",
        status="skipped",
        notes=reason if isinstance(reason, str) and reason else "skipped",
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=["skipped"],
    )


def _sensity_not_implemented_result():
    return make_engine_result(
        engine="sensity_video",
        status="not_implemented",
        notes="not_implemented",
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=["not_implemented"],
    )


def _provider_placeholder(engine, status, notes, signals=None, start_time=None):
    sigs = signals if isinstance(signals, list) else []
    if not sigs:
        if "paid_apis_off" in str(notes):
            sigs.append("paid_apis_disabled")
        if "missing_key" in str(notes):
            sigs.append("missing_key")
        if status == "disabled":
            sigs.append("disabled")
    return make_engine_result(
        engine=engine,
        status=status,
        notes=notes,
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=sigs,
        start_time=start_time,
    )


def _run_reality_defender_with_budget(asset_path: str, budget_sec: float):
    if budget_sec <= 0:
        return _rd_skipped_result("skipped")
    try:
        start = time.time()
        result = analyze_reality_defender(asset_path)
        elapsed = time.time() - start
        if elapsed > budget_sec:
            return _rd_timeout_result()
        return result
    except Exception:
        return _rd_skipped_result("error")


def _normalize_rd_result(raw):
    if isinstance(raw, dict):
        result = dict(raw)
    else:
        result = _rd_skipped_result("error")
    result["engine"] = "reality_defender_video"
    if not result.get("available"):
        status = result.get("status") or "skipped"
        if status not in {"timeout", "skipped", "disabled", "not_available", "error"}:
            status = "skipped"
        result["status"] = status
        result["available"] = False
        result["ai_likelihood"] = None
        result["confidence"] = 0.0
        result["notes"] = result.get("notes") or status
        result["signals"] = result.get("signals") or [status]
    return coerce_engine_result(result, "reality_defender_video")


def _safe_sightengine_result(frame_path):
    try:
        return run_sightengine(frame_path)
    except Exception:
        return make_engine_result(
            engine="sightengine",
            status="error",
            notes="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["error"],
        )


def _normalize_hive_result(raw):
    if not isinstance(raw, dict):
        return make_engine_result(
            engine="hive_video",
            status="error",
            notes="invalid_result",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["invalid_result"],
        )
    if raw.get("ok"):
        fake_val = raw.get("fake")
        ai_value = None
        try:
            if fake_val is not None:
                ai_value = float(fake_val)
                if ai_value > 1.0:
                    ai_value = ai_value / 100.0
        except Exception:
            ai_value = None
        confidence = raw.get("confidence")
        try:
            confidence = float(confidence) if confidence is not None else 0.0
        except Exception:
            confidence = 0.0
        signals = raw.get("details") if isinstance(raw.get("details"), list) else []
        notes = raw.get("message") or "ok"
        return make_engine_result(
            engine="hive_video",
            status="ok",
            notes=notes,
            available=True,
            ai_likelihood=ai_value,
            confidence=confidence,
            signals=signals[:6],
        )
    message = raw.get("message") or "not_available"
    status = raw.get("status") or ("disabled" if "disabled" in str(message).lower() else "not_available")
    signals = raw.get("details") if isinstance(raw.get("details"), list) else []
    return make_engine_result(
        engine="hive_video",
        status=status,
        notes=message,
        available=False,
        ai_likelihood=None,
        confidence=0.0,
        signals=signals[:6],
    )


def _safe_hive_result(frame_path):
    try:
        return _normalize_hive_result(run_hive(frame_path))
    except Exception:
        return make_engine_result(
            engine="hive_video",
            status="error",
            notes="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["error"],
        )


def _apply_sightengine_scores(frame_infos, scores_by_path, sightengine_scores=None):
    scored = 0
    for info in frame_infos:
        frame_path = _p(info.get("path"))
        if not frame_path or frame_path not in scores_by_path:
            continue
        result = _safe_sightengine_result(frame_path)
        if result.get("available") and isinstance(result.get("ai_likelihood"), (int, float)):
            ai_value = float(result.get("ai_likelihood"))
            scores_by_path[frame_path].append(ai_value)
            if isinstance(sightengine_scores, list):
                sightengine_scores.append(ai_value)
            scored += 1
    return scored


def _apply_hive_scores(frame_infos, scores_by_path):
    scored = 0
    results = []
    for info in frame_infos:
        frame_path = _p(info.get("path"))
        if not frame_path or frame_path not in scores_by_path:
            continue
        result = _safe_hive_result(frame_path)
        results.append(result)
        if result.get("available") and isinstance(result.get("ai_likelihood"), (int, float)):
            scores_by_path[frame_path].append(float(result.get("ai_likelihood")))
            scored += 1
    return scored, results


def _apply_reality_defender_scores(frame_infos, scores_by_path, budget_sec):
    scored = 0
    results = []
    start = time.time()
    for info in frame_infos:
        frame_path = _p(info.get("path"))
        if not frame_path or frame_path not in scores_by_path:
            continue
        try:
            elapsed = time.time() - start
            remaining = max(0.0, budget_sec - elapsed)
            if remaining <= 0:
                rd_engine_result = _rd_skipped_result("skipped")
            else:
                rd_engine_result = _normalize_rd_result(
                    _run_reality_defender_with_budget(frame_path, remaining)
                )
        except Exception:
            rd_engine_result = _rd_skipped_result("error")
        results.append(rd_engine_result)
        if rd_engine_result.get("available") and isinstance(rd_engine_result.get("ai_likelihood"), (int, float)):
            scores_by_path[frame_path].append(float(rd_engine_result.get("ai_likelihood")))
            scored += 1
    return scored, results


def _aggregate_rd_results(results, trim_ratio):
    if not results:
        return _rd_skipped_result("skipped")
    valid = [
        r
        for r in results
        if r.get("available") and isinstance(r.get("ai_likelihood"), (int, float))
    ]
    if not valid:
        return results[0]
    if len(valid) == 1:
        return dict(valid[0])
    scores = [float(r.get("ai_likelihood")) for r in valid]
    agg = _trimmed_mean(scores, trim_ratio)
    base = dict(valid[0])
    base["ai_likelihood"] = agg
    confs = [float(r.get("confidence")) for r in valid if isinstance(r.get("confidence"), (int, float))]
    if confs:
        base["confidence"] = sum(confs) / float(len(confs))
    base["notes"] = base.get("notes") or "ok"
    return base


def _aggregate_hive_results(results, trim_ratio):
    if not results:
        return _provider_placeholder("hive_video", "not_available", "no_results")
    valid = [
        r
        for r in results
        if r.get("available") and isinstance(r.get("ai_likelihood"), (int, float))
    ]
    if not valid:
        return coerce_engine_result(results[0], "hive_video")
    if len(valid) == 1:
        return coerce_engine_result(valid[0], "hive_video")
    scores = [float(r.get("ai_likelihood")) for r in valid]
    agg = _trimmed_mean(scores, trim_ratio)
    base = dict(valid[0])
    base["ai_likelihood"] = agg
    confs = [float(r.get("confidence")) for r in valid if isinstance(r.get("confidence"), (int, float))]
    if confs:
        base["confidence"] = sum(confs) / float(len(confs))
    base["notes"] = base.get("notes") or "ok"
    return coerce_engine_result(base, "hive_video")


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
    start = time.time()
    if not os.path.exists(file_path):
        rd_ok, rd_note, rd_status = _reality_defender_status()
        hive_ok, hive_note, hive_status = _hive_status()
        sensity_ok, sensity_note, sensity_status = _sensity_status()
        se_ok, se_note, se_status = _sightengine_status()
        rd_engine_result = _provider_placeholder(
            "reality_defender_video", rd_status, rd_note, start_time=start
        )
        hive_engine_result = _provider_placeholder("hive_video", hive_status, hive_note, start_time=start)
        if sensity_ok:
            sensity_engine_result = _sensity_not_implemented_result()
        else:
            sensity_engine_result = _provider_placeholder(
                "sensity_video", sensity_status, sensity_note, start_time=start
            )
        sightengine_engine_result = _provider_placeholder(
            "sightengine_video", se_status, se_note, start_time=start
        )
        return make_engine_result(
            engine="video_frame_detectors",
            status="error",
            notes="file_missing",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["file_missing"],
            extra={"extra_engine_results": [sightengine_engine_result, rd_engine_result, hive_engine_result, sensity_engine_result]},
            start_time=start,
        )

    rd_ok, rd_note, rd_status = _reality_defender_status()
    hive_ok, hive_note, hive_status = _hive_status()
    sensity_ok, sensity_note, sensity_status = _sensity_status()
    se_ok, se_note, se_status = _sightengine_status()
    use_sightengine = se_ok
    use_reality_defender = rd_ok
    use_hive = hive_ok
    use_sensity = sensity_ok
    engines_used = []
    if use_sightengine:
        engines_used.append("sightengine")
    if use_reality_defender:
        engines_used.append("reality_defender")
    if use_hive:
        engines_used.append("hive")
    if use_sensity:
        engines_used.append("sensity")

    rd_engine_result = _provider_placeholder(
        "reality_defender_video",
        rd_status,
        rd_note,
        start_time=start,
    )
    hive_engine_result = _provider_placeholder(
        "hive_video",
        hive_status,
        hive_note,
        start_time=start,
    )
    sightengine_engine_result = _provider_placeholder(
        "sightengine_video",
        se_status,
        se_note,
        start_time=start,
    )
    if sensity_ok:
        sensity_engine_result = _sensity_not_implemented_result()
    else:
        sensity_engine_result = _provider_placeholder(
            "sensity_video",
            sensity_status,
            sensity_note,
            start_time=start,
        )

    if not engines_used:
        status = "disabled" if not _paid_apis_enabled() else "not_available"
        note = "disabled:paid_apis_off" if status == "disabled" else "not_available"
        return make_engine_result(
            engine="video_frame_detectors",
            status=status,
            notes=note,
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["no_detectors"],
            extra={"extra_engine_results": [sightengine_engine_result, rd_engine_result, hive_engine_result, sensity_engine_result]},
            start_time=start,
        )
    selection_config = _resolve_frame_selection_config()
    frame_strategy = _resolve_frame_strategy()
    frame_limits = _resolve_engine_frame_limits(selection_config.get("selected_target", 0))
    frame_limits = _apply_engine_availability(
        frame_limits, use_sightengine, use_hive, use_reality_defender, use_sensity
    )
    active_engines = [
        engine
        for engine in ("sightengine", "hive", "reality_defender", "sensity")
        if frame_limits.get(engine, 0) > 0
    ]
    selection_config = _ensure_master_frame_target(selection_config, frame_limits, active_engines)
    scan_fps = _env_float("AIREALCHECK_VIDEO_DETECTOR_SCAN_FPS", _env_float("AIREALCHECK_VIDEO_SCAN_FPS", 1.5))
    timeout_sec = _env_float(
        "AIREALCHECK_VIDEO_DETECTOR_TIMEOUT_SEC",
        _env_float("AIREALCHECK_VIDEO_FRAME_TIMEOUT_SEC", 20),
    )
    rd_budget_sec = _env_float(
        "AIREALCHECK_VIDEO_RD_BUDGET_SEC",
        _env_float("AIREALCHECK_VIDEO_RD_TIMEOUT_SEC", 25),
    )
    trim_ratio = _env_float("AIREALCHECK_VIDEO_TRIM", 0.2)
    if trim_ratio < 0:
        trim_ratio = 0.0
    if trim_ratio > 0.45:
        trim_ratio = 0.45
    trim_label = f"{trim_ratio:g}"

    base_tmp = tempfile.gettempdir()
    os.makedirs(base_tmp, exist_ok=True)

    with tempfile.TemporaryDirectory(dir=base_tmp) as tmpdir:
        selected_infos, selection_meta, selection_signals, extract_meta = _extract_master_frame_candidates(
            file_path,
            tmpdir,
            selection_config,
            scan_fps,
            timeout_sec,
        )
        extracted_count = selection_meta.get("frames_extracted", 0)
        selected_count = selection_meta.get("frames_selected", 0)
        _log_debug(f"frames_extracted={extracted_count}")
        if extracted_count == 0:
            note = extract_meta.get("note") if isinstance(extract_meta, dict) else None
            note = note or "no_frames"
            signals = list(selection_signals)
            signals.extend(
                [
                    "frames_scored:0",
                    "sightengine_frames_scored:0",
                    "hive_frames_scored:0",
                    "rd_frames_scored:0",
                    f"agg:trimmed_mean;trim:{trim_label}",
                ]
            )
            return make_engine_result(
                engine="video_frame_detectors",
                status="error",
                notes=note,
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=signals,
                extra={
                    "extra_engine_results": [sightengine_engine_result, rd_engine_result, hive_engine_result, sensity_engine_result],
                },
                start_time=start,
            )

        if selected_count == 0:
            signals = list(selection_signals)
            signals.extend(
                [
                    "frames_scored:0",
                    "sightengine_frames_scored:0",
                    "hive_frames_scored:0",
                    "rd_frames_scored:0",
                    f"agg:trimmed_mean;trim:{trim_label}",
                ]
            )
            return make_engine_result(
                engine="video_frame_detectors",
                status="error",
                notes="no_frames_selected",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=signals,
                extra={
                    "extra_engine_results": [sightengine_engine_result, rd_engine_result, hive_engine_result, sensity_engine_result],
                },
                start_time=start,
            )

        engine_frames = _allocate_engine_frames(selected_infos, frame_limits, frame_strategy)
        _log_debug(f"frames_allocated:sightengine={len(engine_frames.get('sightengine', []))}")
        _log_debug(f"frames_allocated:hive={len(engine_frames.get('hive', []))}")
        _log_debug(f"frames_allocated:reality_defender={len(engine_frames.get('reality_defender', []))}")
        _log_debug(f"frames_allocated:sensity={len(engine_frames.get('sensity', []))}")
        _log_debug(f"frames_allocated:local={len(engine_frames.get('local', []))}")
        scoring_infos = _collect_scoring_frames(engine_frames, ["sightengine", "hive", "reality_defender"])
        scoring_count = len(scoring_infos)
        if scoring_count == 0:
            signals = list(selection_signals)
            signals.extend(
                [
                    "frames_scored:0",
                    "sightengine_frames_scored:0",
                    "hive_frames_scored:0",
                    "rd_frames_scored:0",
                    f"agg:trimmed_mean;trim:{trim_label}",
                ]
            )
            return make_engine_result(
                engine="video_frame_detectors",
                status="error",
                notes="no_frames_allocated",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=signals,
                extra={
                    "extra_engine_results": [sightengine_engine_result, rd_engine_result, hive_engine_result, sensity_engine_result],
                },
                start_time=start,
            )

        frame_scores = []
        failures = 0
        sightengine_scored = 0
        hive_scored = 0
        rd_frames_scored = 0
        rd_results = []
        hive_results = []
        scores_by_path = {_p(info.get("path")): [] for info in scoring_infos if _p(info.get("path"))}
        sightengine_scores = []

        if use_sightengine and engine_frames.get("sightengine"):
            sightengine_scored = _apply_sightengine_scores(
                engine_frames["sightengine"], scores_by_path, sightengine_scores
            )

        if use_hive and engine_frames.get("hive"):
            hive_scored, hive_results = _apply_hive_scores(engine_frames["hive"], scores_by_path)

        if use_reality_defender and engine_frames.get("reality_defender"):
            rd_frames_scored, rd_results = _apply_reality_defender_scores(
                engine_frames["reality_defender"],
                scores_by_path,
                rd_budget_sec,
            )

        for frame_info in scoring_infos:
            frame_path = _p(frame_info.get("path"))
            per_frame_scores = scores_by_path.get(frame_path) if frame_path else None
            if per_frame_scores:
                frame_scores.append(median(per_frame_scores))
            else:
                failures += 1

        frames_scored = len(frame_scores)
        if frames_scored == 0:
            if use_reality_defender:
                rd_engine_result = _aggregate_rd_results(rd_results, trim_ratio)
            if use_hive:
                hive_engine_result = _aggregate_hive_results(hive_results, trim_ratio)
            rd_engine_result = coerce_engine_result(rd_engine_result, "reality_defender_video", start_time=start)
            hive_engine_result = coerce_engine_result(hive_engine_result, "hive_video", start_time=start)
            sensity_engine_result = coerce_engine_result(sensity_engine_result, "sensity_video", start_time=start)
            signals = list(selection_signals)
            signals.extend(
                [
                    f"sightengine_frames_scored:{sightengine_scored}",
                    f"hive_frames_scored:{hive_scored}",
                    f"rd_frames_scored:{rd_frames_scored}",
                    "frames_scored:0",
                    f"engines_used:{','.join(engines_used)}",
                    f"agg:trimmed_mean;trim:{trim_label}",
                ]
            )
            return make_engine_result(
                engine="video_frame_detectors",
                status="error",
                notes="partial",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=signals,
                extra={
                    "extra_engine_results": [sightengine_engine_result, rd_engine_result, hive_engine_result, sensity_engine_result],
                },
                start_time=start,
            )

        median_ai = median(frame_scores)
        variance = _iqr(frame_scores)
        if variance is None:
            variance = 0.0
        video_ai = _trimmed_mean(frame_scores, trim_ratio)
        if video_ai is None:
            video_ai = median_ai

        error_ratio = failures / float(scoring_count) if scoring_count else 1.0
        if frames_scored >= 10 and variance <= 0.1 and error_ratio <= 0.2:
            confidence_label = "high"
            confidence_value = 0.85
        elif frames_scored >= 5 and variance <= 0.2 and error_ratio <= 0.4:
            confidence_label = "medium"
            confidence_value = 0.65
        else:
            confidence_label = "low"
            confidence_value = 0.35

        if use_reality_defender:
            rd_engine_result = _aggregate_rd_results(rd_results, trim_ratio)
        if use_hive:
            hive_engine_result = _aggregate_hive_results(hive_results, trim_ratio)
        rd_engine_result = coerce_engine_result(rd_engine_result, "reality_defender_video", start_time=start)
        hive_engine_result = coerce_engine_result(hive_engine_result, "hive_video", start_time=start)
        sensity_engine_result = coerce_engine_result(sensity_engine_result, "sensity_video", start_time=start)
        if sightengine_scores:
            sightengine_ai = _trimmed_mean(sightengine_scores, trim_ratio)
            if sightengine_ai is None:
                sightengine_ai = median(sightengine_scores)
            if sightengine_ai is not None:
                sightengine_conf = max(sightengine_ai, 1.0 - sightengine_ai)
                sightengine_engine_result = make_engine_result(
                    engine="sightengine_video",
                    status="ok",
                    notes="ok" if failures == 0 else "partial",
                    available=True,
                    ai_likelihood=sightengine_ai,
                    confidence=sightengine_conf,
                    signals=[
                        f"frames_scored:{sightengine_scored}",
                        f"agg:trimmed_mean;trim:{trim_label}",
                    ],
                    start_time=start,
                )
        notes = "ok" if failures == 0 else "partial"
        signals = list(selection_signals)
        signals.extend(
            [
                f"sightengine_frames_scored:{sightengine_scored}",
                f"hive_frames_scored:{hive_scored}",
                f"rd_frames_scored:{rd_frames_scored}",
                f"frames_scored:{frames_scored}",
                f"engines_used:{','.join(engines_used)}",
                f"median_ai:{median_ai:.3f}",
                f"variance:{variance:.3f}",
                f"agg:trimmed_mean;trim:{trim_label}",
            ]
        )

        return make_engine_result(
            engine="video_frame_detectors",
            status="ok",
            notes=notes,
            available=True,
            ai_likelihood=video_ai,
            confidence=confidence_value,
            signals=signals,
            extra={
                "extra_engine_results": [sightengine_engine_result, rd_engine_result, hive_engine_result, sensity_engine_result],
            },
            start_time=start,
        )
