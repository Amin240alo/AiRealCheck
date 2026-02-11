import os

from Backend.engines.hive_engine import run_hive, hive_health_check
from Backend.engines.sightengine_engine import run_sightengine
from Backend.engines.reality_defender_engine import analyze_reality_defender
from Backend.engines.forensics_engine import run_forensics
from Backend.engines.xception_engine import run_xception
from Backend.engines.clip_detector_engine import run_clip_detector
from Backend.engines.c2pa_engine import analyze_c2pa
from Backend.engines.watermark_engine import analyze_watermark
from Backend.engines.audio_forensics_engine import run_audio_forensics
from Backend.engines.audio_aasist_engine import run_audio_aasist
from Backend.engines.audio_prosody_engine import run_audio_prosody

IMAGE_ENGINES = [
    "hive",
    "forensics",
    "sightengine",
    "reality_defender",
    "xception",
    "clip_detector",
    "c2pa",
    "watermark",
]
VIDEO_ENGINES = ["video_frame_detectors", "reality_defender_video", "video_temporal_cnn", "video_temporal", "video_forensics"]
AUDIO_ENGINES = ["audio_forensics", "audio_aasist", "audio_prosody"]
DETECTOR_ENGINES_IMAGE = {"sightengine", "reality_defender", "hive", "xception", "clip_detector"}
DETECTOR_ENGINES_VIDEO = {"reality_defender_video", "video_frame_detectors", "video_temporal_cnn"}
DETECTOR_ENGINES_AUDIO = {"audio_aasist"}


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


def _normalize_engine_result(raw, engine_name):
    raw = raw or {}
    if (
        raw.get("engine") == engine_name
        and "ai_likelihood" in raw
        and "confidence" in raw
        and "signals" in raw
        and "notes" in raw
    ):
        ai = raw.get("ai_likelihood")
        confidence = _normalize_confidence(raw.get("confidence"))
        signals = raw.get("signals") if isinstance(raw.get("signals"), list) else []
        signals = [str(d) for d in signals if d is not None]
        notes = raw.get("notes") or ""
        status = raw.get("status")
        available = raw.get("available")
        if available is None:
            available = notes != "not_available"
        return {
            "engine": engine_name,
            "ai_likelihood": ai if isinstance(ai, (int, float)) else None,
            "confidence": confidence,
            "signals": signals[:6],
            "notes": str(notes),
            "status": status,
            "available": bool(available),
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
    return {
        "engine": engine_name,
        "ai_likelihood": ai_value,
        "confidence": confidence,
        "signals": signals[:6],
        "notes": notes,
        "status": "ok" if ok else "error",
        "available": ok,
    }


def _compute_overall_confidence(spread, engine_count, conflict):
    if engine_count <= 0:
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


def compute_final_score(engine_results, media_type="image"):
    detector_values = _collect_detector_values(engine_results, media_type=media_type, include_xception=False)

    if media_type == "video":
        if len(detector_values) >= 2:
            return _median(detector_values)
        if len(detector_values) == 1:
            return detector_values[0]
        temporal_value = None
        for entry in engine_results or []:
            if not isinstance(entry, dict):
                continue
            if entry.get("engine") != "video_temporal":
                continue
            if not entry.get("available"):
                continue
            temporal_value = _normalize_ai01(entry.get("ai_likelihood"))
            if temporal_value is not None:
                break
        if temporal_value is not None:
            return min(temporal_value, 0.40)
        return None

    if media_type == "audio":
        if detector_values:
            return _median(detector_values)
        return None

    if len(detector_values) >= 2:
        return _median(detector_values)

    if len(detector_values) == 1:
        return detector_values[0]

    if media_type == "image":
        xception_value = None
        for entry in engine_results or []:
            if not isinstance(entry, dict):
                continue
            if entry.get("engine") != "xception":
                continue
            if not entry.get("available"):
                continue
            xception_value = _normalize_ai01(entry.get("ai_likelihood"))
            if xception_value is not None:
                break
        if xception_value is not None:
            return max(0.35, min(0.65, xception_value))

    return None


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


def build_standard_result(media_type, engine_results_raw, analysis_id, ai_likelihood, reasons=None, created_at=None):
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

    detector_values = _collect_detector_values(normalized, media_type=media_type, include_xception=False)
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
    ai_for_output = final_ai if final_ai is not None else _normalize_ai01(ai_likelihood)
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
    _log_calibration(final_ai, confidence_label, detector_values)
    if isinstance(reasons, list) and reasons:
        reasons_out = _build_reasons(verdict, conflict, len(ai_values), reasons_in=reasons)
    else:
        reasons_out = confidence_reasons

    created_at_value = created_at or __import__("datetime").datetime.utcnow().isoformat() + "Z"

    ai_percent = None
    real_percent = None
    if ai_for_output is not None:
        ai_percent = float(ai_for_output) * 100.0
        real_percent = 100.0 - ai_percent

    result = {
        "ok": True,
        "media_type": media_type,
        "analysis_id": analysis_id,
        "ai_likelihood": int(round(ai_percent)) if ai_percent is not None else None,
        "real_likelihood": int(round(real_percent)) if real_percent is not None else None,
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
            }
            for e in normalized
        ],
        "timestamps": {"created_at": created_at_value},
    }
    if prosody_meta_signals:
        result["ensemble_signals"] = prosody_meta_signals
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

    hive_result = run_hive(file_path) if use_hive else {"ok": False, "engine": "hive", "details": [], "warnings": []}
    forensics_result = run_forensics(file_path) if use_forensics else {"ok": False, "engine": "forensics", "details": [], "warnings": []}
    c2pa_result = analyze_c2pa(file_path)
    watermark_result = analyze_watermark(file_path)
    sightengine_result = run_sightengine(file_path)
    reality_defender_result = analyze_reality_defender(file_path)
    xception_result = run_xception(file_path)
    clip_detector_result = run_clip_detector(file_path)

    engines = []
    warnings = []
    if hive_result.get("ok"):
        engines.append(hive_result)
    else:
        warnings.extend(hive_result.get("warnings", []))
    if forensics_result.get("ok"):
        engines.append(forensics_result)
    else:
        warnings.extend(forensics_result.get("warnings", []))

    sources_used = [e["engine"] for e in engines]
    primary_source = "hive" if hive_result.get("ok") else ("forensics" if forensics_result.get("ok") else None)

    if not engines:
        return {
            "ok": False,
            "error": True,
            "message": "No analysis engine available",
            "details": [],
            "warnings": warnings or ["Keine Engine verfuegbar"],
            "primary_source": primary_source,
            "sources_used": sources_used,
            "health": {"hive": hive_health_check()},
        }

    hive_ok = bool(hive_result.get("ok"))
    if hive_ok:
        weights = {"hive": 0.6, "forensics": 0.25}
    else:
        weights = {"forensics": 0.65}

    total_weight = 0.0
    real_sum = 0.0
    fake_sum = 0.0
    for e in engines:
        w = weights.get(e["engine"], 0.0)
        if w <= 0.0:
            continue
        total_weight += w
        real_sum += w * float(e.get("real", 0.0))
        fake_sum += w * float(e.get("fake", 0.0))

    if total_weight <= 0.0:
        total_weight = float(len(engines))
        real_sum = sum(float(e.get("real", 0.0)) for e in engines)
        fake_sum = sum(float(e.get("fake", 0.0)) for e in engines)

    real = round(real_sum / total_weight, 2)
    fake = round(fake_sum / total_weight, 2)

    confidence = _compute_confidence([float(e.get("fake", 0.0)) for e in engines], len(engines), hive_ok)
    verdict = _compute_verdict(real, fake, confidence)

    user_summary = []
    if verdict == "real":
        user_summary.append("Das Ergebnis spricht eher fuer eine echte Aufnahme.")
    elif verdict == "fake":
        user_summary.append("Das Ergebnis spricht eher fuer eine KI/Manipulation.")
    else:
        user_summary.append("Das Ergebnis ist uneindeutig; weitere Pruefung empfohlen.")

    if not hive_ok:
        user_summary.append("Hauptanalyse (Hive) war nicht verfuegbar; Fallback wurde genutzt.")

    details = {
        "hive": hive_result.get("details", []),
        "forensics": forensics_result.get("details", []),
    }

    return {
        "ok": True,
        "verdict": verdict,
        "real": real,
        "fake": fake,
        "confidence": confidence,
        "primary_source": primary_source,
        "sources_used": sources_used,
        "user_summary": user_summary,
        "details": details,
        "warnings": warnings,
        "health": {"hive": hive_health_check()},
        "engine_results_raw": [
            hive_result,
            forensics_result,
            sightengine_result,
            reality_defender_result,
            xception_result,
            clip_detector_result,
            c2pa_result,
            watermark_result,
        ],
    }
