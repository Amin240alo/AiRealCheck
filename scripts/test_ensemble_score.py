from Backend.ensemble import compute_confidence, compute_final_score, build_standard_result


def _entry(engine, ai, available=True, signals=None):
    return {
        "engine": engine,
        "ai_likelihood": ai,
        "available": available,
        "signals": signals or [],
        "confidence": 0.0,
        "notes": "ok",
    }


def _legacy_raw(engine, fake, ok=True):
    return {
        "engine": engine,
        "ok": ok,
        "fake": fake,
        "details": [],
    }


def _expected_pair(fake_value):
    fake_value = float(fake_value)
    if fake_value < 0.0:
        fake_value = 0.0
    if fake_value > 100.0:
        fake_value = 100.0
    ai_int = int(round(fake_value))
    if ai_int < 0:
        ai_int = 0
    if ai_int > 100:
        ai_int = 100
    return ai_int, 100 - ai_int


def _assert_sum(fake_value):
    payload = build_standard_result(
        media_type="image",
        engine_results_raw=[_legacy_raw("hive", fake_value)],
        analysis_id="test",
        ai_likelihood=99,
        reasons=None,
        created_at="2025-01-01T00:00:00Z",
    )
    ai = payload.get("ai_likelihood")
    real = payload.get("real_likelihood")
    if ai is None or real is None:
        raise AssertionError("ai_likelihood/real_likelihood missing")
    expected_ai, expected_real = _expected_pair(fake_value)
    assert ai == expected_ai, f"ai_likelihood {ai} != {expected_ai}"
    assert real == expected_real, f"real_likelihood {real} != {expected_real}"
    assert ai + real == 100, "ai + real should equal 100"
    return ai, real


def main():
    engines = [
        _entry("sightengine", 0.8),
        _entry("reality_defender", 0.7),
        _entry("hive", 85.0),
    ]
    final_ai = compute_final_score(engines)
    label, reasons = compute_confidence(engines, final_ai)
    print("final_ai:", final_ai)
    print("confidence:", label, reasons)

    engines = [
        _entry("c2pa", None, signals=["signature_verified"]),
    ]
    final_ai = compute_final_score(engines)
    label, reasons = compute_confidence(engines, final_ai)
    print("final_ai:", final_ai)
    print("confidence:", label, reasons)

    for value in (12.3, 50.5, 99.6):
        ai, real = _assert_sum(value)
        print("rounded_pair:", value, "->", ai, real)


if __name__ == "__main__":
    main()
