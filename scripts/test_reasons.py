from Backend.ensemble import build_standard_result


def _entry(engine, ai, available=True, status="ok", signals=None, notes="ok"):
    return {
        "engine": engine,
        "ai_likelihood": ai,
        "confidence": 0.0,
        "signals": signals or [],
        "notes": notes,
        "status": status,
        "available": available,
    }


def _print_case(title, payload):
    reasons_user = payload.get("reasons_user", [])
    warnings_user = payload.get("warnings_user", [])
    print(f"\n== {title} ==")
    print("reasons_user:", reasons_user)
    print("warnings_user:", warnings_user)
    assert len(reasons_user) <= 3, "reasons_user max 3"
    assert len(warnings_user) <= 2, "warnings_user max 2"


def main():
    created_at = "2025-01-01T00:00:00Z"

    # Case 1: video conflict + temporal/forensics conflict
    video_conflict = [
        _entry("video_frame_detectors", 10),
        _entry("video_temporal", 90),
        _entry("video_forensics", 95),
        _entry("reality_defender_video", 15),
        _entry("video_temporal_cnn", 30),
    ]
    payload = build_standard_result(
        media_type="video",
        engine_results_raw=video_conflict,
        analysis_id="case_video_conflict",
        ai_likelihood=None,
        reasons=None,
        created_at=created_at,
    )
    _print_case("video_conflict", payload)

    # Case 2: missing high-weight engines
    missing_high_weight = [
        _entry("sightengine", 20),
        _entry("hive", 80, available=False, status="error"),
        _entry("reality_defender", None, available=False, status="error"),
    ]
    payload = build_standard_result(
        media_type="image",
        engine_results_raw=missing_high_weight,
        analysis_id="case_missing_high_weight",
        ai_likelihood=None,
        reasons=None,
        created_at=created_at,
    )
    _print_case("missing_high_weight", payload)

    # Case 3: C2PA verified
    c2pa_verified = [
        _entry("hive", 30),
        _entry("reality_defender", 35),
        _entry("c2pa", None, signals=["signature_verified"], notes="ok"),
    ]
    payload = build_standard_result(
        media_type="image",
        engine_results_raw=c2pa_verified,
        analysis_id="case_c2pa_verified",
        ai_likelihood=None,
        reasons=None,
        created_at=created_at,
    )
    _print_case("c2pa_verified", payload)

    # Case 4: watermark detected
    watermark_detected = [
        _entry("hive", 40),
        _entry("reality_defender", 45),
        _entry("watermark", None, signals=["metadata_ai_hint:exif:midjourney"], notes="metadata_hint_found"),
    ]
    payload = build_standard_result(
        media_type="image",
        engine_results_raw=watermark_detected,
        analysis_id="case_watermark",
        ai_likelihood=None,
        reasons=None,
        created_at=created_at,
    )
    _print_case("watermark_detected", payload)


if __name__ == "__main__":
    main()
