import os
import json
import math

from Backend.engines.hive_engine import run_hive, hive_health_check
from Backend.engines.sightengine_engine import run_sightengine
from Backend.engines.reality_defender_engine import analyze_reality_defender
from Backend.engines.forensics_engine import run_forensics
from Backend.engines.xception_engine import run_xception
from Backend.engines.clip_detector_engine import run_clip_detector
from Backend.engines.c2pa_engine import analyze_c2pa
from Backend.engines.watermark_engine import analyze_watermark
from Backend.engines.sensity_image_engine import analyze_sensity_image
from Backend.engines.audio_forensics_engine import run_audio_forensics
from Backend.engines.audio_aasist_engine import run_audio_aasist
from Backend.engines.audio_prosody_engine import run_audio_prosody
from Backend.engines.engine_utils import safe_engine_call, make_engine_result

IMAGE_ENGINES = [
    "hive",
    "forensics",
    "sightengine",
    "reality_defender",
    "sensity_image",
    "xception",
    "clip_detector",
    "c2pa",
    "watermark",
]
VIDEO_ENGINES = [
    "video_frame_detectors",
    "hive_video",
    "reality_defender_video",
    "sensity_video",
    "video_temporal_cnn",
    "video_temporal",
    "video_forensics",
]
AUDIO_ENGINES = ["audio_forensics", "audio_aasist", "audio_prosody"]
DETECTOR_ENGINES_IMAGE = {"sightengine", "reality_defender", "hive", "sensity_image", "xception", "clip_detector"}
DETECTOR_ENGINES_VIDEO = {
    "reality_defender_video",
    "hive_video",
    "sensity_video",
    "video_frame_detectors",
    "video_temporal_cnn",
}
DETECTOR_ENGINES_AUDIO = {"audio_aasist"}
VIDEO_ENGINE_GROUPS = {
    "frame_apis": {"video_frame_detectors", "reality_defender_video", "hive_video", "sensity_video"},
    "whole_video_apis": set(),
    "local_models": {"video_temporal", "video_temporal_cnn", "video_forensics"},
}
ENGINE_WEIGHTS = {
    "image": {
        "hive": 0.30,
        "reality_defender": 0.25,
        "sightengine": 0.18,
        "sensity_image": 0.05,
        "clip_detector": 0.12,
        "xception": 0.08,
        "forensics": 0.07,
    },
    "video": {
        "reality_defender_video": 0.0,
        "hive_video": 0.0,
        "sensity_video": 0.0,
        "video_temporal_cnn": 0.06,
        "video_frame_detectors": 0.20,
        "video_temporal": 0.16,
        "video_forensics": 0.10,
    },
    "audio": {
        "audio_aasist": 0.65,
        "audio_forensics": 0.25,
        "audio_prosody": 0.10,
    },
}
HIGH_WEIGHT_THRESHOLD = 0.25

_VIDEO_WEIGHTS_CACHE = {"raw": None, "weights": None}
_IMAGE_WEIGHTS_CACHE = {"raw": None, "weights": None}


def _debug_paid_enabled():
    return os.getenv("AIREALCHECK_DEBUG_PAID", "0").lower() in {"1", "true", "yes", "on"}


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _resolve_paid_enable_flag(name, paid_default):
    raw = os.getenv(name)
    if raw is None:
        return paid_default, None
    return raw.lower() in {"1", "true", "yes", "on"}, raw


def _sightengine_creds_present():
    api_user = (os.getenv("SIGHTENGINE_API_USER") or "").strip()
    api_secret = (os.getenv("SIGHTENGINE_API_SECRET") or "").strip()
    if api_user and api_secret:
        return True
    api_key = (os.getenv("SIGHTENGINE_API_KEY") or "").strip()
    if not api_key:
        return False
    if ":" in api_key:
        parts = api_key.split(":", 1)
    elif "," in api_key:
        parts = api_key.split(",", 1)
    else:
        parts = [api_key, ""]
    api_user = parts[0].strip()
    api_secret = parts[1].strip() if len(parts) > 1 else ""
    return bool(api_user and api_secret)


def _reality_defender_creds_present():
    api_key = (os.getenv("REALITY_DEFENDER_API_KEY") or "").strip()
    return bool(api_key)


def _debug_paid_log(engine, paid_enabled, creds_present, env_names, path):
    if not _debug_paid_enabled():
        return
    env_list = ",".join(env_names)
    print(
        f"[paid_debug] engine={engine} "
        f"paid_apis_enabled={paid_enabled} creds_present={creds_present} "
        f"envs=[{env_list}] path={path}"
    )


def _load_video_weights():
    raw = (os.getenv("AIREALCHECK_VIDEO_ENGINE_WEIGHTS_JSON") or "").strip()
    if not raw:
        return ENGINE_WEIGHTS.get("video", {})
    if raw == _VIDEO_WEIGHTS_CACHE.get("raw") and _VIDEO_WEIGHTS_CACHE.get("weights") is not None:
        return _VIDEO_WEIGHTS_CACHE.get("weights") or {}
    try:
        payload = json.loads(raw)
    except Exception:
        return ENGINE_WEIGHTS.get("video", {})
    if isinstance(payload, dict) and isinstance(payload.get("video"), dict):
        payload = payload.get("video")
    if not isinstance(payload, dict):
        return ENGINE_WEIGHTS.get("video", {})
    merged = dict(ENGINE_WEIGHTS.get("video", {}))
    for name, value in payload.items():
        try:
            weight = float(value)
        except Exception:
            continue
        if weight < 0:
            continue
        merged[str(name)] = weight
    _VIDEO_WEIGHTS_CACHE["raw"] = raw
    _VIDEO_WEIGHTS_CACHE["weights"] = merged
    return merged


def _load_image_weights():
    raw = (os.getenv("AIREALCHECK_IMAGE_ENGINE_WEIGHTS_JSON") or "").strip()
    if not raw:
        return ENGINE_WEIGHTS.get("image", {})
    if raw == _IMAGE_WEIGHTS_CACHE.get("raw") and _IMAGE_WEIGHTS_CACHE.get("weights") is not None:
        return _IMAGE_WEIGHTS_CACHE.get("weights") or {}
    try:
        payload = json.loads(raw)
    except Exception:
        return ENGINE_WEIGHTS.get("image", {})
    if isinstance(payload, dict) and isinstance(payload.get("image"), dict):
        payload = payload.get("image")
    if not isinstance(payload, dict):
        return ENGINE_WEIGHTS.get("image", {})
    merged = dict(ENGINE_WEIGHTS.get("image", {}))
    for name, value in payload.items():
        try:
            weight = float(value)
        except Exception:
            continue
        if weight < 0:
            continue
        merged[str(name)] = weight
    _IMAGE_WEIGHTS_CACHE["raw"] = raw
    _IMAGE_WEIGHTS_CACHE["weights"] = merged
    return merged


def _get_engine_weights(media_type):
    if media_type == "video":
        return _load_video_weights()
    if media_type == "image":
        return _load_image_weights()
    return ENGINE_WEIGHTS.get(media_type, {})


def _clamp(value, lo=0.0, hi=100.0):
    try:
        v = float(value)
    except Exception:
        return lo
    return max(lo, min(hi, v))


def _normalize_confidence(value):
    if value is None:
        return 0.5
    if isinstance(value, (int, float)):
        v = float(value)
        if v > 1.0:
            v = v / 100.0 if v <= 100.0 else 1.0
        return max(0.0, min(1.0, v))
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"high", "hoch"}:
            return 0.85
        if v in {"medium", "mittel"}:
            return 0.65
        if v in {"low", "niedrig"}:
            return 0.35
    return 0.5


def _normalize_ai01(value):
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = v / 100.0 if v <= 100.0 else 1.0
    if v > 1.0:
        v = 1.0
    return v


_CALIBRATION_ENGINES = {"xception", "clip_detector"}


def _calibration_enabled() -> bool:
    return os.getenv("AIREALCHECK_IMAGE_CALIBRATION_ENABLE", "false").lower() in {"1", "true", "yes", "on"}


def _calibration_temperature() -> float:
    try:
        temp = float(os.getenv("AIREALCHECK_IMAGE_CALIBRATION_TEMPERATURE", "1.0"))
    except Exception:
        temp = 1.0
    if temp <= 0:
        temp = 1.0
    return temp


def _logit(p, eps=1e-6):
    if p is None:
        return None
    try:
        v = float(p)
    except Exception:
        return None
    if v < eps:
        v = eps
    if v > 1.0 - eps:
        v = 1.0 - eps
    return math.log(v / (1.0 - v))


def _sigmoid(x):
    try:
        return 1.0 / (1.0 + math.exp(-float(x)))
    except Exception:
        return None


def _temperature_scale(p, temperature):
    logit = _logit(p)
    if logit is None:
        return p
    try:
        temp = float(temperature)
    except Exception:
        temp = 1.0
    if temp <= 0:
        temp = 1.0
    scaled = logit / temp
    return _sigmoid(scaled)


def _append_note(notes, extra):
    if not extra:
        return notes
    base = "" if notes is None else str(notes)
    if not base:
        return str(extra)
    if str(extra) in base:
        return base
    return f"{base} | {extra}"


def _apply_local_calibration(engine_name, ai_value, notes):
    if engine_name not in _CALIBRATION_ENGINES:
        return ai_value, notes
    if not _calibration_enabled():
        return ai_value, notes
    if ai_value is None:
        return ai_value, notes
    temp = _calibration_temperature()
    calibrated = _temperature_scale(ai_value, temp)
    if calibrated is None:
        return ai_value, notes
    note = f"calibration:T={temp:.2f},raw={ai_value:.3f},cal={calibrated:.3f}"
    return calibrated, _append_note(notes, note)


def _normalize_engine_result(raw, engine_name):
    raw = raw or {}
    legacy_shape = "ok" in raw
    if (
        not legacy_shape
        and raw.get("engine") == engine_name
        and "ai_likelihood" in raw
        and "confidence" in raw
        and "signals" in raw
        and "notes" in raw
    ):
        ai = _normalize_ai01(raw.get("ai_likelihood"))
        confidence = _normalize_confidence(raw.get("confidence"))
        signals = raw.get("signals") if isinstance(raw.get("signals"), list) else []
        signals = [str(d) for d in signals if d is not None]
        notes = raw.get("notes") or ""
        status = raw.get("status")
        available = raw.get("available")
        timing_ms = raw.get("timing_ms")
        if available is None:
            available = notes != "not_available"
        ai, notes = _apply_local_calibration(engine_name, ai, notes)
        if engine_name == "video_frame_detectors":
            signals_out = signals
        else:
            signals_out = signals[:6]
        return {
            "engine": engine_name,
            "ai_likelihood": ai,
            "confidence": confidence,
            "signals": signals_out,
            "notes": str(notes),
            "status": status,
            "available": bool(available),
            "timing_ms": timing_ms,
        }

    ok = bool(raw.get("ok"))
    ai = None
    if ok and raw.get("fake") is not None:
        ai = _clamp(raw.get("fake"))
    if engine_name == "c2pa":
        ai = None

    details = raw.get("details")
    signals = []
    if isinstance(details, list):
        signals = [str(d) for d in details if d is not None]
    elif details:
        signals = [str(details)]

    notes = ""
    if not ok:
        notes = "not_available"
    else:
        msg = raw.get("message")
        if isinstance(msg, str) and msg.strip():
            notes = msg.strip()

    confidence = _normalize_confidence(raw.get("confidence") if ok else None)
    if not ok:
        confidence = 0.0

    if not ok:
        ai_value = None
    else:
        ai_value = None if engine_name == "c2pa" else (ai if ai is not None else 0)
        ai_value = _normalize_ai01(ai_value)
        ai_value, notes = _apply_local_calibration(engine_name, ai_value, notes)
    timing_ms = raw.get("timing_ms")
    return {
        "engine": engine_name,
        "ai_likelihood": ai_value,
        "confidence": confidence,
        "signals": signals[:6],
        "notes": notes,
        "status": "ok" if ok else "error",
        "available": ok,
        "timing_ms": timing_ms,
    }


def _compute_overall_confidence(spread_or_results, engine_count=None, conflict=None, media_type="image"):
    if isinstance(spread_or_results, (list, tuple)):
        weights = _get_engine_weights(media_type)
        weighted_sum = 0.0
        total_weight = 0.0
        for entry in spread_or_results or []:
            if not isinstance(entry, dict):
                continue
            if not entry.get("available"):
                continue
            if entry.get("ai_likelihood") is None:
                continue
            engine = entry.get("engine")
            weight = weights.get(engine, 0.0)
            if weight <= 0.0:
                continue
            try:
                conf_value = float(entry.get("confidence"))
            except Exception:
                continue
            if conf_value > 1.0:
                conf_value = conf_value / 100.0 if conf_value <= 100.0 else 1.0
            if conf_value < 0.0:
                conf_value = 0.0
            if conf_value > 1.0:
                conf_value = 1.0
            weighted_sum += conf_value * weight
            total_weight += weight
        if total_weight <= 0.0:
            return 0.0
        return max(0.0, min(1.0, weighted_sum / total_weight))

    spread = spread_or_results
    if engine_count is None:
        return 0.0
    if conflict:
        return 0.35
    if engine_count == 1:
        return 0.55
    if spread <= 10.0:
        return 0.85
    if spread <= 20.0:
        return 0.7
    if spread <= 30.0:
        return 0.55
    return 0.45


def _verdict_from_ai(ai_likelihood):
    ai_likelihood = _clamp(ai_likelihood)
    if ai_likelihood <= 20.0:
        return "likely_real", "green", "Ueberwiegend echt", "Likely real"
    if ai_likelihood <= 60.0:
        return "uncertain", "yellow", "Unsicher", "Uncertain"
    return "likely_ai", "red", "Ueberwiegend KI", "Likely AI-generated"


def _build_reasons(verdict, conflict, engine_count, reasons_in=None):
    if isinstance(reasons_in, list) and reasons_in:
        cleaned = [str(r).strip() for r in reasons_in if r is not None and str(r).strip()]
        return cleaned[:3] if cleaned else []

    reasons = []
    if conflict:
        reasons.append("Modelle uneinig")
    if verdict == "likely_ai":
        reasons.append("KI-Signale ueberwiegen")
    elif verdict == "likely_real":
        reasons.append("Keine starken KI-Indikatoren gefunden")
    else:
        reasons.append("Gemischte Signale")
    if engine_count <= 1:
        reasons.append("Nur ein Signal verfuegbar")
    if verdict == "uncertain" or conflict:
        reasons.append("Zweiten Check empfohlen")
    return reasons[:3]


def _weighted_average(engine_results, media_type="image"):
    weights = _get_engine_weights(media_type)
    weighted_sum = 0.0
    total_weight = 0.0
    used_engines = set()
    for entry in engine_results or []:
        if not isinstance(entry, dict):
            continue
        if not entry.get("available"):
            continue
        if entry.get("ai_likelihood") is None:
            continue
        engine = entry.get("engine")
        weight = weights.get(engine, 0.0)
        if weight <= 0.0:
            continue
        ai_value = _normalize_ai01(entry.get("ai_likelihood"))
        if ai_value is None:
            continue
        weighted_sum += ai_value * weight
        total_weight += weight
        used_engines.add(engine)
    if total_weight <= 0.0:
        return None, used_engines
    return (weighted_sum / total_weight), used_engines


def _compute_video_grouped_score(engine_results):
    weights = _get_engine_weights("video")
    group_scores = {}
    group_weights = {}
    groups_used = []
    for group_name, engines in VIDEO_ENGINE_GROUPS.items():
        group_entries = [
            entry for entry in engine_results or [] if isinstance(entry, dict) and entry.get("engine") in engines
        ]
        group_score, used_engines = _weighted_average(group_entries, media_type="video")
        if group_score is None or not used_engines:
            continue
        group_weight = sum(weights.get(engine, 0.0) for engine in used_engines)
        if group_weight <= 0.0:
            continue
        group_scores[group_name] = group_score
        group_weights[group_name] = group_weight
        groups_used.append(group_name)
    if not group_scores:
        return None, []
    total_weight = sum(group_weights.values())
    if total_weight <= 0.0:
        return None, []
    final_score = sum(group_scores[name] * group_weights[name] for name in group_scores) / total_weight
    return final_score, groups_used


def _high_weight_status(engine_results, media_type="image"):
    weights = _get_engine_weights(media_type)
    high_engines = {name for name, weight in weights.items() if weight >= HIGH_WEIGHT_THRESHOLD}
    if not high_engines:
        return [], False, 0.0
    present = {}
    for entry in engine_results or []:
        if not isinstance(entry, dict):
            continue
        if not entry.get("available"):
            continue
        if entry.get("ai_likelihood") is None:
            continue
        status = entry.get("status")
        if status is not None and str(status).lower() not in {"ok"}:
            continue
        engine_name = entry.get("engine")
        if engine_name:
            present[engine_name] = entry
    missing = [name for name in sorted(high_engines) if name not in present]
    values = []
    for name in high_engines:
        entry = present.get(name)
        if not entry:
            continue
        ai_value = _normalize_ai01(entry.get("ai_likelihood"))
        if ai_value is None:
            continue
        values.append(ai_value)
    conflict = False
    delta = 0.0
    if len(values) >= 2:
        delta = max(values) - min(values)
        if delta > 0.6:
            conflict = True
    return missing, conflict, delta


def _percent_pair_from_ai(ai_for_output):
    if ai_for_output is None:
        return None, None
    try:
        v = float(ai_for_output)
    except Exception:
        return None, None
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = 1.0
    ai_percent = v * 100.0
    ai_int = int(round(ai_percent))
    if ai_int < 0:
        ai_int = 0
    elif ai_int > 100:
        ai_int = 100
    real_int = 100 - ai_int
    return ai_int, real_int


def _clamp01(value):
    try:
        v = float(value)
    except Exception:
        return None
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _signal_value(signals, name):
    if not isinstance(signals, list):
        return None
    target = str(name).strip().lower()
    for entry in signals:
        if isinstance(entry, dict):
            if str(entry.get("name", "")).strip().lower() == target:
                return entry.get("value")
        elif isinstance(entry, str):
            s = entry.strip()
            s_lower = s.lower()
            if s_lower.startswith(f"{target}:") or s_lower.startswith(f"{target}="):
                sep = ":" if ":" in s else "="
                parts = s.split(sep, 1)
                if len(parts) == 2:
                    return parts[1].strip()
    return None


def _signal_float(signals, name):
    value = _signal_value(signals, name)
    try:
        return float(value)
    except Exception:
        return None


def _median(values):
    if not values:
        return None
    vals = sorted(values)
    mid = len(vals) // 2
    if len(vals) % 2 == 1:
        return vals[mid]
    return (vals[mid - 1] + vals[mid]) / 2.0


def _collect_detector_values(engine_results, media_type="image", include_xception=True):
    if media_type == "video":
        detector_engines = DETECTOR_ENGINES_VIDEO
    elif media_type == "audio":
        detector_engines = DETECTOR_ENGINES_AUDIO
    else:
        detector_engines = DETECTOR_ENGINES_IMAGE
    if media_type == "image" and not include_xception:
        detector_engines = {e for e in detector_engines if e != "xception"}
    values = []
    for entry in engine_results or []:
        if not isinstance(entry, dict):
            continue
        if entry.get("engine") not in detector_engines:
            continue
        if not entry.get("available"):
            continue
        ai_value = _normalize_ai01(entry.get("ai_likelihood"))
        if ai_value is not None:
            values.append(ai_value)
    return values


def compute_final_score(engine_results, media_type="image", return_groups=False):
    groups_used = []
    if media_type == "video":
        final_ai, groups_used = _compute_video_grouped_score(engine_results)
    else:
        final_ai, used_engines = _weighted_average(engine_results, media_type=media_type)
        if final_ai is None:
            return (None, []) if return_groups else None
        if media_type == "image" and used_engines == {"xception"}:
            clamp_enabled = os.getenv("AIREALCHECK_IMAGE_XCEPTION_CLAMP_ENABLED", "true").lower() in {
                "1",
                "true",
                "yes",
                "on",
            }
            if clamp_enabled:
                try:
                    clamp_min = float(os.getenv("AIREALCHECK_IMAGE_XCEPTION_CLAMP_MIN", "0.35"))
                except Exception:
                    clamp_min = 0.35
                try:
                    clamp_max = float(os.getenv("AIREALCHECK_IMAGE_XCEPTION_CLAMP_MAX", "0.65"))
                except Exception:
                    clamp_max = 0.65
                clamp_min = max(0.0, min(1.0, clamp_min))
                clamp_max = max(0.0, min(1.0, clamp_max))
                if clamp_min > clamp_max:
                    clamp_min, clamp_max = clamp_max, clamp_min

                x_conf = None
                for entry in engine_results or []:
                    if not isinstance(entry, dict):
                        continue
                    if entry.get("engine") != "xception":
                        continue
                    if not entry.get("available"):
                        continue
                    try:
                        x_conf = float(entry.get("confidence"))
                    except Exception:
                        x_conf = None
                    break

                low_conf = 0.55
                high_conf = 0.85
                if x_conf is None:
                    widen = 0.0
                elif x_conf >= high_conf:
                    widen = 1.0
                elif x_conf <= low_conf:
                    widen = 0.0
                else:
                    widen = (x_conf - low_conf) / (high_conf - low_conf)

                widen_amt = 0.25 * widen
                clamp_min = max(0.0, clamp_min - widen_amt)
                clamp_max = min(1.0, clamp_max + widen_amt)
                final_ai = max(clamp_min, min(clamp_max, final_ai))

                # Xception-only shaping: avoid persistent mid-band (46-54%) without inflating confidence.
                # If the score sits in the deadzone, collapse to 0.5; otherwise apply mild sharpening.
                dead_low, dead_high = 0.46, 0.54
                if dead_low <= final_ai <= dead_high:
                    final_ai = 0.5
                else:
                    logit = _logit(final_ai)
                    if logit is not None:
                        final_ai = _sigmoid(logit * 1.15) or final_ai
                        final_ai = max(clamp_min, min(clamp_max, final_ai))
    if return_groups:
        return final_ai, groups_used
    return final_ai


def compute_confidence(engine_results, final_ai, media_type="image"):
    c2pa_verified = False
    detector_values = []
    temporal_value = None
    forensics_value = None
    xception_value = None

    for entry in engine_results or []:
        if not isinstance(entry, dict):
            continue
        engine = entry.get("engine")
        if engine == "c2pa":
            signals = entry.get("signals") or []
            if any(str(s).strip().lower() == "signature_verified" for s in signals):
                c2pa_verified = True
        if media_type == "video":
            detector_set = DETECTOR_ENGINES_VIDEO
        elif media_type == "audio":
            detector_set = DETECTOR_ENGINES_AUDIO
        else:
            detector_set = DETECTOR_ENGINES_IMAGE
        if engine in detector_set and entry.get("available"):
            if media_type == "image" and engine == "xception":
                xception_value = _normalize_ai01(entry.get("ai_likelihood"))
                continue
            ai_value = _normalize_ai01(entry.get("ai_likelihood"))
            if ai_value is not None:
                detector_values.append(ai_value)
        if media_type == "video" and engine == "video_temporal" and entry.get("available"):
            temporal_value = _normalize_ai01(entry.get("ai_likelihood"))
        if media_type == "video" and engine == "video_forensics" and entry.get("available"):
            forensics_value = _normalize_ai01(entry.get("ai_likelihood"))

    if c2pa_verified:
        return "high", ["Content Credentials verifiziert"]

    if media_type == "audio":
        if len(detector_values) == 0:
            return "low", ["Keine Audio-Signale verfuegbar"]
        if len(detector_values) == 1:
            return "low", ["Nur ein Audio-Signal verfuegbar"]
        diff = max(detector_values) - min(detector_values)
        if diff <= 0.15:
            return "high", ["Audio-Signale stimmen ueberein"]
        return "medium", ["Audio-Signale uneinig", "Zweiten Check empfohlen"]

    if media_type == "image" and len(detector_values) == 0 and xception_value is not None:
        return "low", ["Nur wenige Signale verfuegbar", "fallback:xception"]

    if media_type == "video" and len(detector_values) == 0:
        if temporal_value is not None:
            return "low", ["Keine Bild-Detektoren aktiv fuer Video-Frames.", "fallback:temporal"]
        return "low", ["Keine Bild-Detektoren aktiv fuer Video-Frames.", "fallback:none"]

    if len(detector_values) >= 2:
        diff = max(detector_values) - min(detector_values)
        if diff <= 0.15:
            label = "high"
            reasons = ["Modelle stimmen ueberein"]
        else:
            label = "medium"
            reasons = ["Modelle uneinig", "Zweiten Check empfohlen"]
    else:
        label = "low"
        reasons = ["Nur wenige Signale verfuegbar"]

    if media_type == "image" and detector_values and final_ai is not None and xception_value is not None:
        delta = abs(final_ai - xception_value)
        if delta >= 0.40:
            label = "low"
            reasons = reasons + ["xception_conflict"]
        elif delta >= 0.25 and label == "high":
            label = "medium"
            reasons = reasons + ["xception_conflict"]
        elif delta >= 0.25:
            reasons = reasons + ["xception_conflict"]

    if media_type == "video" and detector_values and final_ai is not None:
        if temporal_value is not None:
            delta = abs(final_ai - temporal_value)
            if delta >= 0.40:
                label = "low"
                reasons = reasons + ["temporal_conflict"]
            elif delta >= 0.25 and label == "high":
                label = "medium"
                reasons = reasons + ["temporal_conflict"]
            elif delta >= 0.25:
                reasons = reasons + ["temporal_conflict"]
        if forensics_value is not None:
            delta = abs(final_ai - forensics_value)
            if delta >= 0.40:
                label = "low"
                reasons = reasons + ["forensics_conflict"]
            elif delta >= 0.25 and label == "high":
                label = "medium"
                reasons = reasons + ["forensics_conflict"]
            elif delta >= 0.25:
                reasons = reasons + ["forensics_conflict"]

    return label, reasons


def build_user_reasons(result_payload, engine_results_normalized, media_type):
    reasons_user = []
    warnings_user = []
    seen = set()

    def _add(target, text):
        if not text:
            return
        if text in seen:
            return
        if target == "reasons":
            if len(reasons_user) >= 3:
                return
            reasons_user.append(text)
        else:
            if len(warnings_user) >= 2:
                return
            warnings_user.append(text)
        seen.add(text)

    payload = result_payload if isinstance(result_payload, dict) else {}
    reasons_raw = payload.get("reasons")
    if not isinstance(reasons_raw, list):
        reasons_raw = []

    def _is_present(entry):
        if not isinstance(entry, dict):
            return False
        if not entry.get("available"):
            return False
        if entry.get("ai_likelihood") is None:
            return False
        status = entry.get("status")
        if status is not None and str(status).lower() not in {"ok"}:
            return False
        return True

    missing_high_weight, _high_conflict, _high_delta = _high_weight_status(
        engine_results_normalized, media_type=media_type
    )
    if missing_high_weight:
        _add("warnings", "Wichtige Pruefer waren nicht verfuegbar")

    conflict = bool(payload.get("conflict"))
    if conflict:
        _add("reasons", "Modelle sind sich uneinig - zweiter Check empfohlen")

    if media_type == "video":
        lowered = {str(r).strip().lower() for r in reasons_raw}
        if "temporal_conflict" in lowered or "forensics_conflict" in lowered:
            _add("reasons", "Bewegungsmuster / Videospuren widersprechen sich")

    if media_type == "audio":
        audio_present = 0
        for entry in engine_results_normalized or []:
            if not isinstance(entry, dict):
                continue
            if entry.get("engine") not in AUDIO_ENGINES:
                continue
            if _is_present(entry):
                audio_present += 1
        if audio_present <= 1:
            _add("warnings", "Nur wenige Audio-Signale verfuegbar")

    c2pa_verified = False
    watermark_found = False
    for entry in engine_results_normalized or []:
        if not isinstance(entry, dict):
            continue
        if not entry.get("available"):
            continue
        engine = entry.get("engine")
        if engine == "c2pa":
            signals = entry.get("signals") or []
            if any(str(s).strip().lower() == "signature_verified" for s in signals):
                c2pa_verified = True
        if engine == "watermark":
            signals = entry.get("signals") or []
            notes = str(entry.get("notes") or "").lower()
            if any("metadata_ai_hint" in str(s).lower() for s in signals):
                watermark_found = True
            elif "metadata_hint_found" in notes:
                watermark_found = True

    if c2pa_verified:
        _add("reasons", "Inhaltsnachweis gefunden (C2PA)")
    if watermark_found:
        _add("reasons", "Wasserzeichen-Hinweis gefunden")

    primary_source = payload.get("primary_source") if isinstance(payload.get("primary_source"), str) else None
    if not primary_source:
        present = {
            entry.get("engine")
            for entry in engine_results_normalized or []
            if _is_present(entry) and entry.get("engine")
        }
        if media_type == "image":
            for name in ("hive", "forensics", "reality_defender", "sightengine", "clip_detector", "xception"):
                if name in present:
                    primary_source = name
                    break
        elif media_type == "video":
            for name in (
                "video_forensics",
                "video_frame_detectors",
                "video_temporal_cnn",
                "video_temporal",
                "reality_defender_video",
            ):
                if name in present:
                    primary_source = name
                    break
        elif media_type == "audio":
            for name in ("audio_aasist", "audio_forensics", "audio_prosody"):
                if name in present:
                    primary_source = name
                    break

    if primary_source and "forensics" in primary_source:
        _add("warnings", "Analyse basiert vor allem auf Forensik")

    return reasons_user, warnings_user


def _log_calibration(final_ai, confidence_label, detector_values):
    try:
        import json
        import datetime

        os.makedirs("data", exist_ok=True)
        ts = datetime.datetime.utcnow().isoformat() + "Z"
        row = {
            "ts": ts,
            "final_ai": final_ai,
            "confidence_label": confidence_label,
            "detector_values": detector_values,
        }

        json_path = os.path.join("data", "analysis_log.jsonl")
        with open(json_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

        csv_path = os.path.join("data", "analysis_log.csv")
        header_needed = not os.path.exists(csv_path)
        with open(csv_path, "a", encoding="utf-8") as f:
            if header_needed:
                f.write("ts,final_ai,confidence_label,detector_values\n")
            values_str = ";".join([f"{v:.4f}" for v in detector_values]) if detector_values else ""
            f.write(f"{ts},{final_ai},{confidence_label},{values_str}\n")
    except Exception:
        return


def build_standard_result(
    media_type, engine_results_raw, analysis_id, ai_likelihood, reasons=None, created_at=None, debug_paid=None
):
    engine_results_raw = engine_results_raw or []
    by_engine = {r.get("engine"): r for r in engine_results_raw if isinstance(r, dict) and r.get("engine")}
    if media_type == "video":
        engine_list = VIDEO_ENGINES
    elif media_type == "audio":
        engine_list = AUDIO_ENGINES
    else:
        engine_list = IMAGE_ENGINES
    if media_type == "video" and "audio_forensics" in by_engine and "audio_forensics" not in engine_list:
        engine_list = engine_list + ["audio_forensics"]
    normalized = [_normalize_engine_result(by_engine.get(name), name) for name in engine_list]

    if media_type == "video":
        for entry in normalized:
            if entry.get("engine") == "video_forensics" and entry.get("available") is True:
                entry["notes"] = entry.get("notes") or "hint:ok"

    ai_values = [
        e["ai_likelihood"]
        for e in normalized
        if e.get("available") and isinstance(e.get("ai_likelihood"), (int, float))
    ]
    spread = 0.0
    if len(ai_values) >= 2:
        spread = max(ai_values) - min(ai_values)
    conflict = bool(len(ai_values) >= 2 and spread >= 40.0)
    missing_high_weight, high_weight_conflict, _high_weight_delta = _high_weight_status(
        normalized, media_type=media_type
    )
    if high_weight_conflict:
        conflict = True

    detector_values = _collect_detector_values(normalized, media_type=media_type, include_xception=False)
    group_used = []
    if media_type == "video":
        final_ai, group_used = compute_final_score(normalized, media_type=media_type, return_groups=True)
    else:
        final_ai = compute_final_score(normalized, media_type=media_type)
    prosody_meta_signals = []
    prosody_conflict = False
    prosody_ai = None
    voiced_ratio = None
    duration_s = None
    aasist_ai = None
    aasist_confidence = None
    aasist_prob_spoof = None
    force_unsure = False
    if media_type == "audio":
        aasist_raw = by_engine.get("audio_aasist")
        if isinstance(aasist_raw, dict):
            aasist_signals = aasist_raw.get("signals") or []
            duration_s = _signal_float(aasist_signals, "duration_s")
            aasist_prob_spoof = _signal_float(aasist_signals, "prob_spoof")
        for entry in normalized:
            if entry.get("engine") == "audio_aasist":
                aasist_ai = _normalize_ai01(entry.get("ai_likelihood"))
                try:
                    aasist_confidence = float(entry.get("confidence"))
                except Exception:
                    aasist_confidence = None
                break

        prosody_raw = by_engine.get("audio_prosody")
        if duration_s is None and isinstance(prosody_raw, dict):
            duration_s = _signal_float(prosody_raw.get("signals") or [], "duration_s")
        if duration_s is None:
            forensics_raw = by_engine.get("audio_forensics")
            if isinstance(forensics_raw, dict):
                duration_s = _signal_float(forensics_raw.get("signals") or [], "duration_s")
        if isinstance(prosody_raw, dict) and prosody_raw.get("available") and aasist_ai is not None:
            signals = prosody_raw.get("signals") or []
            jitter = _signal_float(signals, "jitter_approx")
            f0_std = _signal_float(signals, "f0_std_hz")
            rms_cv = _signal_float(signals, "rms_cv")
            voiced_ratio = _signal_float(signals, "voiced_ratio")
            if jitter is not None and f0_std is not None and rms_cv is not None:
                j_ai = _clamp01((0.6 - jitter) / 0.6)
                f_ai = _clamp01((6.0 - f0_std) / 6.0)
                r_ai = _clamp01((0.35 - rms_cv) / 0.35)
                if j_ai is not None and f_ai is not None and r_ai is not None:
                    prosody_ai = _clamp01(0.45 * j_ai + 0.35 * f_ai + 0.20 * r_ai)
                    if prosody_ai is not None:
                        w = 0.20
                        if voiced_ratio is not None and voiced_ratio < 0.20:
                            w = 0.08
                        w_cap = 0.35
                        if aasist_confidence is not None and aasist_confidence < 0.60:
                            w = w + 0.10
                            w_cap = 0.45
                        if voiced_ratio is not None and voiced_ratio >= 0.30 and prosody_ai >= 0.75:
                            w = max(w, 0.30)
                        if w > w_cap:
                            w = w_cap
                        mixed = _clamp01((1.0 - w) * aasist_ai + w * prosody_ai)
                        if mixed is not None:
                            final_ai = mixed
                            prosody_conflict = abs(aasist_ai - prosody_ai) > 0.50
                            prosody_meta_signals = [
                                {"name": "ensemble_w_prosody", "value": round(float(w), 3), "type": "meta"},
                                {"name": "prosody_ai", "value": round(float(prosody_ai), 4), "type": "score"},
                                {"name": "conflict_signals", "value": bool(prosody_conflict), "type": "meta"},
                            ]
        if aasist_prob_spoof is None:
            aasist_prob_spoof = aasist_ai
        if aasist_prob_spoof is not None and aasist_prob_spoof >= 0.75:
            if final_ai is None:
                final_ai = aasist_ai if aasist_ai is not None else 0.65
            final_ai = max(final_ai, 0.65)
        if prosody_ai is not None and aasist_ai is not None and prosody_ai >= 0.70 and aasist_ai >= 0.40:
            final_ai = max(final_ai, 0.70)
        if prosody_ai is not None and aasist_ai is not None and aasist_ai < 0.20 and prosody_ai >= 0.75:
            force_unsure = True
        if force_unsure:
            forced_signal = {"name": "forced_uncertain", "value": True, "type": "meta"}
            if isinstance(prosody_meta_signals, list) and prosody_meta_signals:
                prosody_meta_signals.append(forced_signal)
            else:
                prosody_meta_signals = [forced_signal]
    # final_ai is the single source of truth for output scores.
    ai_for_output = final_ai
    if ai_for_output is None:
        verdict, traffic_light, label_de, label_en = "uncertain", "yellow", "Unsicher", "Uncertain"
    else:
        verdict, traffic_light, label_de, label_en = _verdict_from_ai(ai_for_output * 100.0)
    confidence = _compute_overall_confidence(spread, len(ai_values), conflict)
    confidence_label, confidence_reasons = compute_confidence(normalized, final_ai, media_type=media_type)
    if media_type == "image":
        non_xception_available = any(
            e.get("available") and e.get("engine") in {"sightengine", "reality_defender", "hive"}
            for e in normalized
        )
        xception_available = any(
            e.get("available") and e.get("engine") == "xception"
            for e in normalized
        )
        if (not non_xception_available) and xception_available:
            verdict, traffic_light, label_de, label_en = "uncertain", "yellow", "Unsicher", "Uncertain"
            confidence_label = "low"
            confidence_reasons = ["Nur wenige Signale verfuegbar", "fallback:xception"]
            confidence = min(confidence, 0.35)
    if media_type == "audio":
        low_reasons = []
        if prosody_conflict:
            confidence = min(confidence, 0.55)
            low_reasons.append("Widerspruechliche Audio-Signale")
        if voiced_ratio is not None and voiced_ratio < 0.20:
            low_reasons.append("Wenig Stimme im Audio")
        if duration_s is not None and duration_s < 6.0:
            low_reasons.append("Kurzes Audio (<6s)")
        if low_reasons:
            confidence_label = "low"
            if isinstance(confidence_reasons, list):
                confidence_reasons = confidence_reasons + low_reasons
            else:
                confidence_reasons = low_reasons
        high_allowed = (not prosody_conflict) and (
            ai_for_output is not None and (ai_for_output <= 0.20 or ai_for_output >= 0.80)
        )
        if confidence_label == "high" and not high_allowed:
            confidence_label = "medium"
        if confidence_label == "high" and high_allowed:
            if isinstance(confidence_reasons, list):
                confidence_reasons = confidence_reasons + ["Klares Audio-Signal"]
            else:
                confidence_reasons = ["Klares Audio-Signal"]
        if force_unsure:
            verdict, traffic_light, label_de, label_en = "uncertain", "yellow", "Unsicher", "Uncertain"
            confidence_label = "low"
            if isinstance(confidence_reasons, list):
                confidence_reasons = confidence_reasons + ["Prosody stark trotz niedriger AASIST"]
            else:
                confidence_reasons = ["Prosody stark trotz niedriger AASIST"]
    if missing_high_weight or high_weight_conflict:
        if not isinstance(confidence_reasons, list):
            confidence_reasons = [str(confidence_reasons)] if confidence_reasons is not None else []
        if missing_high_weight:
            penalty = 0.12 * len(missing_high_weight)
            confidence = max(0.15, confidence - penalty)
            if len(missing_high_weight) >= 2:
                confidence_label = "low"
            elif confidence_label == "high":
                confidence_label = "medium"
            confidence_reasons = confidence_reasons + [
                f"missing_high_weight:{name}" for name in missing_high_weight
            ]
        if high_weight_conflict:
            confidence = min(confidence, 0.25)
            confidence_label = "low"
            confidence_reasons = confidence_reasons + ["high_weight_conflict"]

    primary_source_override = None
    primary_source = None
    if media_type == "video":
        weights = _get_engine_weights("video")
        candidates = sorted(
            [name for name, weight in weights.items() if weight >= HIGH_WEIGHT_THRESHOLD],
            key=lambda n: weights.get(n, 0.0),
            reverse=True,
        )
        for name in candidates:
            entry = next((e for e in normalized if e.get("engine") == name), None)
            if not entry or not entry.get("available"):
                continue
            status = entry.get("status")
            if status is not None and str(status).lower() not in {"ok"}:
                continue
            ai_value = entry.get("ai_likelihood")
            if not isinstance(ai_value, (int, float)):
                continue
            try:
                conf_value = float(entry.get("confidence"))
            except Exception:
                conf_value = 0.0
            ai_pct = float(ai_value) * 100.0 if ai_value <= 1.0 else float(ai_value)
            if ai_pct <= 10.0 and conf_value >= 0.85:
                primary_source_override = name
                break
    if primary_source_override:
        primary_source = primary_source_override
        verdict = "real"
        traffic_light = "green"
        label_de = "Ueberwiegend echt"
        label_en = "Likely real"
        if confidence_label == "low":
            confidence_label = "medium"
    _log_calibration(final_ai, confidence_label, detector_values)
    if isinstance(reasons, list) and reasons:
        reasons_out = _build_reasons(verdict, conflict, len(ai_values), reasons_in=reasons)
    else:
        reasons_out = confidence_reasons

    created_at_value = created_at or __import__("datetime").datetime.utcnow().isoformat() + "Z"

    ai_out = None
    real_out = None
    if ai_for_output is not None:
        ai_out, real_out = _percent_pair_from_ai(ai_for_output)

    ensemble_signals = []
    if media_type == "video" and group_used:
        ensemble_signals.extend([f"group_used:{name}" for name in group_used])
    if prosody_meta_signals:
        ensemble_signals.extend(prosody_meta_signals)

    result = {
        "ok": True,
        "media_type": media_type,
        "analysis_id": analysis_id,
        "ai_likelihood": ai_out,
        "real_likelihood": real_out,
        "verdict": verdict,
        "traffic_light": traffic_light,
        "label_de": label_de,
        "label_en": label_en,
        "conflict": conflict,
        "confidence": round(confidence, 3),
        "confidence_label": confidence_label,
        "reasons": reasons_out,
        "final_ai": final_ai,
        "final_real": (1.0 - final_ai) if final_ai is not None else None,
        "engine_results": [
            {
                "engine": e["engine"],
                "ai_likelihood": (
                    int(round(e["ai_likelihood"]))
                    if isinstance(e.get("ai_likelihood"), (int, float))
                    else None
                ),
                "confidence": round(float(e["confidence"]), 3),
                "signals": e["signals"],
                "notes": e["notes"],
                "status": e.get("status"),
                "available": bool(e.get("available")),
                "timing_ms": e.get("timing_ms"),
            }
            for e in normalized
        ],
        "timestamps": {"created_at": created_at_value},
        **({"primary_source": primary_source} if primary_source is not None else {}),
    }
    reasons_user, warnings_user = build_user_reasons(result, normalized, media_type)
    result["reasons_user"] = reasons_user
    result["warnings_user"] = warnings_user
    if ensemble_signals:
        result["ensemble_signals"] = ensemble_signals
    if debug_paid is not None and _debug_paid_enabled():
        result["debug_paid"] = debug_paid
    return result


def run_audio_ensemble(file_path: str):
    aasist_result = run_audio_aasist(file_path)
    if not isinstance(aasist_result, dict):
        aasist_result = {
            "engine": "audio_aasist",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": [],
            "notes": "error",
            "status": "error",
            "available": False,
        }

    forensics_result = run_audio_forensics(file_path)
    if not isinstance(forensics_result, dict):
        forensics_result = {
            "engine": "audio_forensics",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": [],
            "notes": "error",
            "status": "error",
            "available": False,
        }
    prosody_result = run_audio_prosody(file_path)
    if not isinstance(prosody_result, dict):
        prosody_result = {
            "engine": "audio_prosody",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": [],
            "notes": "error",
            "status": "error",
            "available": False,
        }
    warnings = []
    if not aasist_result.get("available"):
        warnings.append("audio_aasist_unavailable")
    if not forensics_result.get("available"):
        warnings.append("audio_forensics_unavailable")
    if not prosody_result.get("available"):
        warnings.append("audio_prosody_unavailable")

    primary_source = "audio_aasist"
    if not aasist_result.get("available") and forensics_result.get("available"):
        primary_source = "audio_forensics"

    return {
        "engine_results_raw": [aasist_result, forensics_result, prosody_result],
        "primary_source": primary_source,
        "warnings": warnings,
    }


def _compute_confidence(scores, engine_count, hive_ok):
    if engine_count <= 1:
        base = scores[0] if scores else 50.0
        if hive_ok and base >= 80.0:
            return "medium"
        return "low"

    spread = max(scores) - min(scores)
    top = max(scores)
    if hive_ok and top >= 80.0 and spread <= 15.0:
        return "high"
    if spread <= 25.0:
        return "medium"
    return "low"


def _compute_verdict(real, fake, confidence):
    if confidence != "low" and fake >= 70.0:
        return "fake"
    if confidence != "low" and real >= 70.0:
        return "real"
    return "uncertain"


def run_ensemble(file_path: str):
    use_hive = os.getenv("HIVE_ENABLED", "true").lower() in {"1", "true", "yes"}
    use_forensics = os.getenv("AIREALCHECK_IMAGE_FALLBACK", "true").lower() in {"1", "true", "yes"}
    enable_hive = os.getenv("AIREALCHECK_ENABLE_HIVE_IMAGE", "false").lower() in {"1", "true", "yes", "on"}
    paid_enabled = _paid_apis_enabled()
    enable_rd, enable_rd_raw = _resolve_paid_enable_flag("AIREALCHECK_ENABLE_REALITY_DEFENDER_IMAGE", paid_enabled)
    enable_sightengine, enable_sightengine_raw = _resolve_paid_enable_flag(
        "AIREALCHECK_ENABLE_SIGHTENGINE_IMAGE", paid_enabled
    )
    enable_sensity = os.getenv("AIREALCHECK_ENABLE_SENSITY_IMAGE", "false").lower() in {"1", "true", "yes", "on"}
    hive_result = None
    forensics_result = None
    sightengine_result = None
    reality_defender_result = None
    sensity_image_result = None
    xception_result = None
    clip_detector_result = None
    c2pa_result = None
    watermark_result = None
    engine_results_raw_list = []
    normalized = []

    def _disabled_engine(engine_name: str):
        return make_engine_result(
            engine=engine_name,
            status="disabled",
            notes="disabled:flag_off",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["disabled"],
            timing_ms=0,
        )

    def _exception_placeholder(engine_name: str, note: str):
        return make_engine_result(
            engine=engine_name,
            status="error",
            notes=note,
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=["exception"],
            timing_ms=0,
        )

    def _debug_paid_reason(enabled, raw_value, paid_enabled_value, flag_name):
        if enabled:
            return "request"
        if raw_value is None:
            if not paid_enabled_value:
                return "disabled:flag_off:paid_apis_off"
            return f"disabled:flag_off:{flag_name}:default"
        raw_clean = str(raw_value).strip() or "empty"
        return f"disabled:flag_off:{flag_name}={raw_clean}"

    debug_paid = None
    if _debug_paid_enabled():
        sight_creds = _sightengine_creds_present()
        rd_creds = _reality_defender_creds_present()
        sight_envs = [
            "AIREALCHECK_USE_PAID_APIS",
            "AIREALCHECK_ENABLE_SIGHTENGINE_IMAGE",
            "SIGHTENGINE_API_USER",
            "SIGHTENGINE_API_SECRET",
            "SIGHTENGINE_API_KEY",
        ]
        rd_envs = [
            "AIREALCHECK_USE_PAID_APIS",
            "AIREALCHECK_ENABLE_REALITY_DEFENDER_IMAGE",
            "REALITY_DEFENDER_API_KEY",
        ]
        sight_reason = _debug_paid_reason(
            enable_sightengine, enable_sightengine_raw, paid_enabled, "AIREALCHECK_ENABLE_SIGHTENGINE_IMAGE"
        )
        rd_reason = _debug_paid_reason(
            enable_rd, enable_rd_raw, paid_enabled, "AIREALCHECK_ENABLE_REALITY_DEFENDER_IMAGE"
        )
        _debug_paid_log("sightengine", paid_enabled, sight_creds, sight_envs, sight_reason)
        _debug_paid_log("reality_defender", paid_enabled, rd_creds, rd_envs, rd_reason)
        debug_paid = {
            "sightengine": {"attempted": bool(enable_sightengine), "reason": sight_reason},
            "reality_defender": {"attempted": bool(enable_rd), "reason": rd_reason},
        }

    def _attach_debug_paid(payload):
        if debug_paid is not None and isinstance(payload, dict):
            payload["debug_paid"] = debug_paid
        return payload

    def _build_engine_results():
        raw_list = [
            hive_result,
            forensics_result,
            sightengine_result,
            reality_defender_result,
            sensity_image_result,
            xception_result,
            clip_detector_result,
            c2pa_result,
            watermark_result,
        ]
        by_engine = {r.get("engine"): r for r in raw_list if isinstance(r, dict) and r.get("engine")}
        normalized_list = [_normalize_engine_result(by_engine.get(name), name) for name in IMAGE_ENGINES]
        return raw_list, normalized_list

    try:
        if not enable_hive:
            hive_result = _disabled_engine("hive")
        elif use_hive:
            hive_result = safe_engine_call("hive", run_hive, file_path)
        else:
            hive_result = make_engine_result(
                engine="hive",
                status="disabled",
                notes="disabled:hive_off",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=["disabled"],
                timing_ms=0,
            )
        forensics_result = (
            safe_engine_call("forensics", run_forensics, file_path)
            if use_forensics
            else make_engine_result(
                engine="forensics",
                status="disabled",
                notes="disabled:forensics_off",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=["disabled"],
                timing_ms=0,
            )
        )
        c2pa_result = safe_engine_call("c2pa", analyze_c2pa, file_path)
        watermark_result = safe_engine_call("watermark", analyze_watermark, file_path)
        sightengine_result = (
            safe_engine_call("sightengine", run_sightengine, file_path)
            if enable_sightengine
            else _disabled_engine("sightengine")
        )
        reality_defender_result = (
            safe_engine_call("reality_defender", analyze_reality_defender, file_path)
            if enable_rd
            else _disabled_engine("reality_defender")
        )
        sensity_image_result = (
            safe_engine_call("sensity_image", analyze_sensity_image, file_path)
            if enable_sensity
            else _disabled_engine("sensity_image")
        )
        xception_result = safe_engine_call("xception", run_xception, file_path)
        clip_detector_result = safe_engine_call("clip_detector", run_clip_detector, file_path)

        engine_results_raw_list, normalized = _build_engine_results()

        warnings = []
        hive_ok = bool(hive_result.get("ok")) if isinstance(hive_result, dict) else False
        forensics_ok = bool(forensics_result.get("ok")) if isinstance(forensics_result, dict) else False
        if isinstance(hive_result, dict) and not hive_ok:
            warnings.extend(hive_result.get("warnings", []))
        if isinstance(forensics_result, dict) and not forensics_ok:
            warnings.extend(forensics_result.get("warnings", []))

        sources_used = [
            entry.get("engine")
            for entry in normalized
            if entry.get("available") and isinstance(entry.get("engine"), str)
        ]
        primary_source = "hive" if hive_ok else ("forensics" if forensics_ok else None)

        available_ai = [
            entry
            for entry in normalized
            if isinstance(entry, dict) and entry.get("available") and entry.get("ai_likelihood") is not None
        ]

        final_ai = compute_final_score(normalized, media_type="image")
        if final_ai is not None:
            try:
                final_ai = float(final_ai)
            except Exception:
                final_ai = None
        if final_ai is not None:
            if final_ai < 0.0:
                final_ai = 0.0
            if final_ai > 1.0:
                final_ai = 1.0

        confidence = _compute_overall_confidence(normalized, media_type="image")
        verdict = "unknown"
        if final_ai is not None:
            if final_ai >= 0.60 and confidence >= 0.55:
                verdict = "fake"
            elif final_ai <= 0.40 and confidence >= 0.55:
                verdict = "real"
            else:
                verdict = "uncertain"

        if final_ai is None:
            real = 0.0
            fake = 0.0
        else:
            fake = round(float(final_ai) * 100.0, 2)
            real = round((1.0 - float(final_ai)) * 100.0, 2)

        user_summary = []
        if verdict == "real":
            user_summary.append("Das Ergebnis spricht eher fuer eine echte Aufnahme.")
        elif verdict == "fake":
            user_summary.append("Das Ergebnis spricht eher fuer eine KI/Manipulation.")
        elif verdict == "unknown":
            user_summary.append("Keine belastbaren Signale verfuegbar.")
        else:
            user_summary.append("Das Ergebnis ist uneindeutig; weitere Pruefung empfohlen.")

        if not hive_ok:
            user_summary.append("Hauptanalyse (Hive) war nicht verfuegbar; Fallback wurde genutzt.")

        details = {
            "hive": hive_result.get("details", []) if isinstance(hive_result, dict) else [],
            "forensics": forensics_result.get("details", []) if isinstance(forensics_result, dict) else [],
        }

        if not available_ai:
            return _attach_debug_paid(
                {
                "ok": False,
                "error": True,
                "message": "No analysis engine available",
                "details": [],
                "warnings": warnings or ["Keine Engine verfuegbar"],
                "primary_source": primary_source,
                "sources_used": sources_used,
                "health": {"hive": hive_health_check()},
                "final_ai": final_ai,
                "verdict": verdict,
                "confidence": confidence,
                "real": real,
                "fake": fake,
                "engine_results_raw": engine_results_raw_list,
                "engine_results": normalized,
            }
            )

        return _attach_debug_paid(
            {
            "ok": True,
            "verdict": verdict,
            "real": real,
            "fake": fake,
            "confidence": confidence,
            "final_ai": final_ai,
            "primary_source": primary_source,
            "sources_used": sources_used,
            "user_summary": user_summary,
            "details": details,
            "warnings": warnings,
            "health": {"hive": hive_health_check()},
            "engine_results_raw": engine_results_raw_list,
            "engine_results": normalized,
        }
        )
    except Exception as exc:
        err_note = f"exception:{type(exc).__name__}"
        if not engine_results_raw_list:
            engine_results_raw_list = [
                hive_result if isinstance(hive_result, dict) else _exception_placeholder("hive", err_note),
                forensics_result if isinstance(forensics_result, dict) else _exception_placeholder("forensics", err_note),
                sightengine_result if isinstance(sightengine_result, dict) else _exception_placeholder("sightengine", err_note),
                reality_defender_result
                if isinstance(reality_defender_result, dict)
                else _exception_placeholder("reality_defender", err_note),
                sensity_image_result
                if isinstance(sensity_image_result, dict)
                else _exception_placeholder("sensity_image", err_note),
                xception_result if isinstance(xception_result, dict) else _exception_placeholder("xception", err_note),
                clip_detector_result
                if isinstance(clip_detector_result, dict)
                else _exception_placeholder("clip_detector", err_note),
                c2pa_result if isinstance(c2pa_result, dict) else _exception_placeholder("c2pa", err_note),
                watermark_result if isinstance(watermark_result, dict) else _exception_placeholder("watermark", err_note),
            ]
        if not normalized:
            by_engine = {
                r.get("engine"): r for r in engine_results_raw_list if isinstance(r, dict) and r.get("engine")
            }
            normalized = [_normalize_engine_result(by_engine.get(name), name) for name in IMAGE_ENGINES]
        return _attach_debug_paid(
            {
            "ok": False,
            "error": err_note,
            "message": str(exc),
            "details": [],
            "warnings": [err_note],
            "final_ai": None,
            "verdict": "unknown",
            "confidence": 0.0,
            "real": 0.0,
            "fake": 0.0,
            "engine_results_raw": engine_results_raw_list,
            "engine_results": normalized,
        }
        )
