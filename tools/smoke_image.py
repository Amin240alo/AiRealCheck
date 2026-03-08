import argparse
import os

from Backend.ensemble import build_standard_result, run_ensemble

MAX_BYTES_DEFAULT = 50 * 1024 * 1024


def _preflight(path, max_bytes):
    if not path:
        return False, "missing_path"
    if not os.path.exists(path):
        return False, "file_missing"
    try:
        size = os.path.getsize(path)
    except Exception:
        return False, "size_error"
    if size <= 0:
        return False, "file_empty"
    if max_bytes is not None and size > max_bytes:
        return False, "file_too_large"
    return True, "ok"


def _summary_line(result):
    engine = result.get("engine", "unknown")
    status = result.get("status")
    available = result.get("available")
    ai_likelihood = result.get("ai_likelihood")
    confidence = result.get("confidence")
    notes = result.get("notes")
    return (
        f"{engine:24} status={status} available={available} "
        f"ai={ai_likelihood} conf={confidence} notes={notes}"
    )


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Smoke test the Phase-2 image pipeline on a local file."
    )
    parser.add_argument("path", help="Path to a local image file")
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=MAX_BYTES_DEFAULT,
        help=f"Max file size in bytes (default: {MAX_BYTES_DEFAULT})",
    )
    args = parser.parse_args(argv)

    ok, reason = _preflight(args.path, args.max_bytes)
    if not ok:
        print(f"preflight: failed reason={reason}")
        return 2

    print("preflight: ok")

    result = run_ensemble(args.path)
    engine_results_raw = []
    source = "empty"
    if isinstance(result, dict):
        raw = result.get("engine_results_raw")
        if isinstance(raw, list):
            engine_results_raw = raw
            source = "engine_results_raw"
        else:
            fallback = result.get("engine_results")
            if isinstance(fallback, list):
                engine_results_raw = fallback
                source = "engine_results"
            else:
                normalized = result.get("normalized")
                if isinstance(normalized, list):
                    engine_results_raw = normalized
                    source = "normalized"
        if os.getenv("AIREALCHECK_DEBUG", "0") == "1":
            keys = ", ".join(sorted(result.keys()))
            print(f"debug: run_ensemble keys=[{keys}] source={source}")
            err = result.get("error")
            msg = result.get("message")
            if err is not None or msg:
                print(f"debug: run_ensemble error={err} message={msg}")

    standard_payload = build_standard_result(
        media_type="image",
        engine_results_raw=engine_results_raw,
        analysis_id="smoke-image",
        ai_likelihood=None,
        reasons=None,
    )
    engine_results = standard_payload.get("engine_results") or []

    if not engine_results:
        print("engine summary: none")
        return 1

    print("engine summary:")
    for entry in engine_results:
        print(_summary_line(entry))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
