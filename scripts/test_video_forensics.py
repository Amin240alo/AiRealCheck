import sys

from Backend.engines.video_forensics_engine import run_video_forensics


def main():
    if len(sys.argv) < 2:
        print("usage: python scripts/test_video_forensics.py <video_path>")
        return 2
    path = sys.argv[1]
    result = run_video_forensics(path)
    print(result)
    status = str(result.get("status") or "").lower()
    signals = result.get("signals") or []
    frames = 0
    for item in signals:
        if isinstance(item, str) and item.lower().startswith("frames_analyzed:"):
            try:
                frames = int(item.split(":", 1)[1].strip())
            except Exception:
                frames = 0
            break
    if status != "ok" or frames == 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
