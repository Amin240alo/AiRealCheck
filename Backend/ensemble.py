import os

from Backend.engines.hive_engine import run_hive, hive_health_check
from Backend.engines.forensics_engine import run_forensics

KNOWN_ENGINES = ["hive", "forensics"]


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
    ok = bool(raw.get("ok"))
    ai = None
    if ok and raw.get("fake") is not None:
        ai = _clamp(raw.get("fake"))

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

    return {
        "engine": engine_name,
        "ai_likelihood": ai if ai is not None else 0,
        "confidence": confidence,
        "signals": signals[:6],
        "notes": notes,
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
    if ai_likelihood <= 30.0:
        return "likely_real", "green", "Ueberwiegend echt", "Likely real"
    if ai_likelihood <= 69.0:
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


def build_standard_result(media_type, engine_results_raw, analysis_id, ai_likelihood, reasons=None, created_at=None):
    engine_results_raw = engine_results_raw or []
    by_engine = {r.get("engine"): r for r in engine_results_raw if isinstance(r, dict) and r.get("engine")}
    normalized = [_normalize_engine_result(by_engine.get(name), name) for name in KNOWN_ENGINES]

    ai_values = [e["ai_likelihood"] for e in normalized if e.get("available")]
    spread = 0.0
    if len(ai_values) >= 2:
        spread = max(ai_values) - min(ai_values)
    conflict = bool(len(ai_values) >= 2 and spread >= 40.0)

    verdict, traffic_light, label_de, label_en = _verdict_from_ai(ai_likelihood)
    confidence = _compute_overall_confidence(spread, len(ai_values), conflict)
    reasons_out = _build_reasons(verdict, conflict, len(ai_values), reasons_in=reasons)

    created_at_value = created_at or __import__("datetime").datetime.utcnow().isoformat() + "Z"

    return {
        "ok": True,
        "media_type": media_type,
        "analysis_id": analysis_id,
        "ai_likelihood": int(round(_clamp(ai_likelihood))),
        "real_likelihood": int(round(100.0 - _clamp(ai_likelihood))),
        "verdict": verdict,
        "traffic_light": traffic_light,
        "label_de": label_de,
        "label_en": label_en,
        "conflict": conflict,
        "confidence": round(confidence, 3),
        "reasons": reasons_out,
        "engine_results": [
            {
                "engine": e["engine"],
                "ai_likelihood": int(round(e["ai_likelihood"])),
                "confidence": round(float(e["confidence"]), 3),
                "signals": e["signals"],
                "notes": e["notes"],
                "available": bool(e.get("available")),
            }
            for e in normalized
        ],
        "timestamps": {"created_at": created_at_value},
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
        "engine_results_raw": [hive_result, forensics_result],
    }
