from Backend.ensemble import compute_confidence, compute_final_score


def _entry(engine, ai, available=True, signals=None):
    return {
        "engine": engine,
        "ai_likelihood": ai,
        "available": available,
        "signals": signals or [],
        "confidence": 0.0,
        "notes": "ok",
    }


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


if __name__ == "__main__":
    main()
