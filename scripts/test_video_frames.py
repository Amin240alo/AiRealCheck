import os
import sys

try:
    import cv2
except Exception:
    cv2 = None

try:
    import imagehash
except Exception:
    imagehash = None

from Backend.engines.video_frame_detectors_engine import extract_and_select_video_frames


def _print_env(name):
    value = os.getenv(name)
    if value is None or value == "":
        value = "<unset>"
    print(f"env:{name}={value}")


def main():
    if len(sys.argv) < 2:
        print("usage: python scripts/test_video_frames.py <video_path>")
        return 1
    _print_env("AIREALCHECK_VIDEO_FRAMES_EXTRACT")
    _print_env("AIREALCHECK_VIDEO_FRAMES_SELECTED")
    _print_env("AIREALCHECK_VIDEO_RD_MAX_FRAMES")
    _print_env("AIREALCHECK_VIDEO_TRIM")
    print(f"cv2_available: {cv2 is not None}")
    print(f"imagehash_available: {imagehash is not None}")
    path = sys.argv[1]
    result = extract_and_select_video_frames(path)
    print(f"frames_extracted: {result.get('frames_extracted', 0)}")
    print(f"frames_after_filters: {result.get('frames_after_filters', 0)}")
    print(f"frames_selected: {result.get('frames_selected', 0)}")
    note = result.get("note")
    if note and note != "ok":
        print(f"note: {note}")
    signals = result.get("signals") or []
    for signal in signals:
        print(f"signal: {signal}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
