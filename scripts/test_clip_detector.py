import os
import sys

from Backend.engines.clip_detector_engine import run_clip_detector


def _resolve_paths():
    ai_path = (os.getenv("AIREALCHECK_CLIP_TEST_AI") or "").strip()
    real_path = (os.getenv("AIREALCHECK_CLIP_TEST_REAL") or "").strip()
    if not ai_path and len(sys.argv) > 1:
        ai_path = sys.argv[1]
    if not real_path and len(sys.argv) > 2:
        real_path = sys.argv[2]
    if not ai_path or not real_path:
        print("Usage: python scripts/test_clip_detector.py <ai_image> <real_image>")
        print("Or set AIREALCHECK_CLIP_TEST_AI and AIREALCHECK_CLIP_TEST_REAL.")
        return None, None
    return ai_path, real_path


def _print_result(label, path, result):
    print(f"\n[{label}] {path}")
    if not isinstance(result, dict):
        print("result: invalid")
        return
    print("status:", result.get("status"), "available:", result.get("available"))
    print("ai_likelihood:", result.get("ai_likelihood"))
    print("confidence:", result.get("confidence"))
    print("notes:", result.get("notes"))
    print("signals:", result.get("signals"))


def main():
    ai_path, real_path = _resolve_paths()
    if not ai_path or not real_path:
        return

    real_embeddings = (os.getenv("AIREALCHECK_CLIP_EMBEDDINGS_PATH") or "").strip()
    ai_embeddings = (os.getenv("AIREALCHECK_CLIP_AI_EMBEDDINGS_PATH") or "").strip()
    print("[embeddings] real:", real_embeddings if real_embeddings else "(default)")
    print("[embeddings] ai:", ai_embeddings if ai_embeddings else "(not set)")

    ai_res = run_clip_detector(ai_path)
    real_res = run_clip_detector(real_path)
    _print_result("AI", ai_path, ai_res)
    _print_result("REAL", real_path, real_res)


if __name__ == "__main__":
    main()
