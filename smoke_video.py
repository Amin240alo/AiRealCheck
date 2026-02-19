import argparse
import sys

from Backend.engines.engine_utils import safe_engine_call
from Backend.engines.video_forensics_engine import run_video_forensics
from Backend.engines.video_frame_detectors_engine import run_video_frame_detectors
from Backend.engines.video_temporal_cnn_engine import run_video_temporal_cnn
from Backend.engines.video_temporal_engine import run_video_temporal
from Backend.video_validation import validate_video_input


def _summary_line(result):
    engine = result.get("engine", "unknown")
    status = result.get("status")
    available = result.get("available")
    notes = result.get("notes")
    timing_ms = result.get("timing_ms")
    return (
        f"{engine:24} status={status} available={available} "
        f"notes={notes} timing_ms={timing_ms}"
    )


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Smoke test the Phase-1 video pipeline on a local file."
    )
    parser.add_argument("path", help="Path to a local video file")
    args = parser.parse_args(argv)

    validation = validate_video_input(args.path)
    if not validation.get("ok"):
        code = validation.get("code")
        http_status = validation.get("http_status")
        notes = validation.get("notes")
        print(f"preflight: failed code={code} http_status={http_status} notes={notes}")
        return 2

    print("preflight: ok")

    video_detectors = safe_engine_call("video_frame_detectors", run_video_frame_detectors, args.path)
    video_temporal_cnn = safe_engine_call("video_temporal_cnn", run_video_temporal_cnn, args.path)
    video_temporal = safe_engine_call("video_temporal", run_video_temporal, args.path)
    video_forensics = safe_engine_call("video_forensics", run_video_forensics, args.path)

    results = [video_detectors]
    extra = video_detectors.get("extra_engine_results") if isinstance(video_detectors, dict) else None
    if isinstance(extra, list):
        results.extend([item for item in extra if isinstance(item, dict)])
    results.extend([video_temporal_cnn, video_temporal, video_forensics])

    print("engine summary:")
    for result in results:
        print(_summary_line(result))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
