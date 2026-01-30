import sys

from Backend.engines.video_forensics_engine import extract_video_frames


def main():
    if len(sys.argv) < 2:
        print("usage: python scripts/test_video_extract.py <video_path>")
        return 1
    path = sys.argv[1]
    frames, meta = extract_video_frames(path, max_frames=120, scan_fps=2.0, timeout_sec=20)
    count = len(frames) if frames else 0
    print(f"frames_extracted: {count}")
    if meta and meta.get("note") not in {None, "ok"}:
        print(f"note: {meta.get('note')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
