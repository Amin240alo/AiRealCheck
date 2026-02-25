import argparse
import csv
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv, find_dotenv
except Exception:
    load_dotenv = None
    find_dotenv = None

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

if load_dotenv and find_dotenv:
    _DOTENV_PATH = find_dotenv(".env", usecwd=True)
    if _DOTENV_PATH:
        load_dotenv(_DOTENV_PATH, override=False)

from Backend.ensemble import run_ensemble, build_standard_result

IMAGE_EXTS = {
    ".jpg",
    ".jpeg",
    ".jfif",
    ".png",
    ".webp",
    ".bmp",
    ".gif",
    ".tif",
    ".tiff",
    ".heic",
    ".heif",
    ".avif",
    ".jp2",
    ".j2k",
    ".jpf",
    ".jpx",
    ".ico",
}

VIDEO_EXTS = {
    ".mp4",
    ".mov",
    ".mkv",
    ".webm",
    ".avi",
    ".m4v",
}

AUDIO_EXTS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".aac",
    ".flac",
    ".ogg",
    ".opus",
}

LABEL_MAP = {"real": 0, "ai": 1}

CSV_COLUMNS = [
    "filename",
    "media_type",
    "true_label",
    "ai_score_percent",
    "predicted_label",
    "confidence",
    "conflict",
    "status",
]


def _relative_path(path: Path, root: Path) -> str:
    try:
        rel = path.relative_to(root)
    except Exception:
        rel = path.name
    return str(rel).replace("\\", "/")


def _collect_image_items(dataset_root: Path):
    items = []
    for label_name, label_value in LABEL_MAP.items():
        base_dir = dataset_root / "image" / label_name
        if not base_dir.exists():
            continue
        for path in base_dir.rglob("*"):
            if not path.is_file():
                continue
            if IMAGE_EXTS and path.suffix.lower() not in IMAGE_EXTS:
                continue
            rel = _relative_path(path, dataset_root)
            items.append((path, label_value, rel))
    items.sort(key=lambda item: item[2])
    return items


def _collect_video_items(dataset_root: Path):
    items = []
    for label_name, label_value in LABEL_MAP.items():
        base_dir = dataset_root / "video" / label_name
        if not base_dir.exists():
            continue
        for path in base_dir.rglob("*"):
            if not path.is_file():
                continue
            if VIDEO_EXTS and path.suffix.lower() not in VIDEO_EXTS:
                continue
            rel = _relative_path(path, dataset_root)
            items.append((path, label_value, rel))
    items.sort(key=lambda item: item[2])
    return items


def _collect_audio_items(dataset_root: Path):
    items = []
    for label_name, label_value in LABEL_MAP.items():
        base_dir = dataset_root / "audio" / label_name
        if not base_dir.exists():
            continue
        for path in base_dir.rglob("*"):
            if not path.is_file():
                continue
            if AUDIO_EXTS and path.suffix.lower() not in AUDIO_EXTS:
                continue
            rel = _relative_path(path, dataset_root)
            items.append((path, label_value, rel))
    items.sort(key=lambda item: item[2])
    return items


def _response_to_payload(response):
    if isinstance(response, dict):
        return response, None
    if isinstance(response, tuple):
        resp_obj, status_code = response
    else:
        resp_obj, status_code = response, None
    if hasattr(resp_obj, "get_json"):
        data = resp_obj.get_json(silent=True)
        if data is not None:
            resp_obj = data
    if not isinstance(resp_obj, dict):
        raise ValueError("analysis_response_invalid")
    return resp_obj, status_code


def _analyze_image_path(file_path: str, analysis_id: str, created_at: str):
    result = run_ensemble(file_path)
    if not isinstance(result, dict):
        raise ValueError("ensemble_result_invalid")
    debug_paid = result.get("debug_paid") if isinstance(result, dict) else None
    standard_payload = build_standard_result(
        media_type="image",
        engine_results_raw=result.get("engine_results_raw", []),
        analysis_id=analysis_id,
        ai_likelihood=None,
        reasons=None,
        created_at=created_at,
        debug_paid=debug_paid,
    )
    status = "ok" if result.get("ok") and not result.get("error") else "error"
    return standard_payload, status


def _run_video_analysis(file_path: str, filename: str):
    from Backend import server as server_module

    app = server_module.app
    with app.test_request_context("/analyze?type=video", method="POST"):
        return server_module._run_analysis_path(
            file_path, filename, media_type="video", user_ctx=None, charge_credit=False
        )


def _run_audio_analysis(file_path: str, filename: str):
    from Backend import server as server_module

    app = server_module.app
    with app.test_request_context("/analyze?type=audio", method="POST"):
        return server_module._run_analysis_path(
            file_path, filename, media_type="audio", user_ctx=None, charge_credit=False
        )


def _analyze_video_path(file_path: str):
    filename = os.path.basename(file_path)
    response = _run_video_analysis(file_path, filename)
    payload, status_code = _response_to_payload(response)
    status = "ok"
    if not payload.get("ok") or payload.get("error"):
        status = "error"
    if status_code is not None and int(status_code) >= 400:
        status = "error"
    return payload, status


def _analyze_audio_path(file_path: str):
    filename = os.path.basename(file_path)
    response = _run_audio_analysis(file_path, filename)
    payload, status_code = _response_to_payload(response)
    status = "ok"
    if not payload.get("ok") or payload.get("error"):
        status = "error"
    if status_code is not None and int(status_code) >= 400:
        status = "error"
    return payload, status


def run_benchmark(
    dataset_root="benchmark_dataset",
    media="image",
    output_csv="data/benchmark_results.csv",
    threshold=0.5,
    max_items=None,
):
    dataset_root = Path(dataset_root)
    output_csv = Path(output_csv)

    if media == "image":
        items = _collect_image_items(dataset_root)
        analyzer = _analyze_image_path
        media_type = "image"
    elif media == "video":
        items = _collect_video_items(dataset_root)
        analyzer = _analyze_video_path
        media_type = "video"
    elif media == "audio":
        items = _collect_audio_items(dataset_root)
        analyzer = _analyze_audio_path
        media_type = "audio"
    else:
        print(f"media '{media}' not implemented yet")
        return 0

    if max_items is not None:
        try:
            max_items = int(max_items)
        except Exception:
            max_items = None
    if max_items is not None and max_items >= 0:
        items = items[:max_items]

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    header_needed = not output_csv.exists() or output_csv.stat().st_size == 0

    processed = 0
    with open(output_csv, "a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        if header_needed:
            writer.writeheader()
            handle.flush()

        for path, true_label, rel in items:
            analysis_id = str(uuid.uuid4())
            created_at = datetime.utcnow().isoformat() + "Z"
            row = {
                "filename": rel,
                "media_type": media_type,
                "true_label": true_label,
                "ai_score_percent": "",
                "predicted_label": "",
                "confidence": "",
                "conflict": "",
                "status": "error",
            }

            try:
                if media_type == "image":
                    payload, status = analyzer(str(path), analysis_id, created_at)
                else:
                    payload, status = analyzer(str(path))
                ai_score_percent = payload.get("ai_likelihood")
                if isinstance(ai_score_percent, (int, float)):
                    ai_score_percent = float(ai_score_percent)
                else:
                    ai_score_percent = None

                confidence_raw = payload.get("confidence")
                confidence_pct = None
                if isinstance(confidence_raw, (int, float)):
                    confidence_pct = float(confidence_raw) * 100.0

                predicted_label = None
                if ai_score_percent is not None:
                    predicted_label = 1 if (ai_score_percent / 100.0) >= float(threshold) else 0

                row.update(
                    {
                        "ai_score_percent": "" if ai_score_percent is None else round(ai_score_percent, 3),
                        "predicted_label": "" if predicted_label is None else predicted_label,
                        "confidence": "" if confidence_pct is None else round(confidence_pct, 3),
                        "conflict": payload.get("conflict") if "conflict" in payload else "",
                        "status": status,
                    }
                )
            except Exception:
                row["status"] = "error"

            writer.writerow(row)
            handle.flush()
            processed += 1

    return processed


def main():
    parser = argparse.ArgumentParser(description="Run AIRealCheck benchmark dataset evaluation.")
    parser.add_argument("--dataset-root", default="benchmark_dataset")
    parser.add_argument("--media", default="image", choices=["image", "video", "audio", "all"])
    parser.add_argument("--output-csv", default="data/benchmark_results.csv")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--max-items", type=int, default=None)
    args = parser.parse_args()

    if args.media == "all":
        processed = run_benchmark(
            dataset_root=args.dataset_root,
            media="image",
            output_csv=args.output_csv,
            threshold=args.threshold,
            max_items=args.max_items,
        )
        processed += run_benchmark(
            dataset_root=args.dataset_root,
            media="video",
            output_csv=args.output_csv,
            threshold=args.threshold,
            max_items=args.max_items,
        )
        processed += run_benchmark(
            dataset_root=args.dataset_root,
            media="audio",
            output_csv=args.output_csv,
            threshold=args.threshold,
            max_items=args.max_items,
        )
        print(f"processed {processed} items -> {args.output_csv}")
        return

    processed = run_benchmark(
        dataset_root=args.dataset_root,
        media=args.media,
        output_csv=args.output_csv,
        threshold=args.threshold,
        max_items=args.max_items,
    )
    if args.media in {"image", "video", "audio"}:
        print(f"processed {processed} items -> {args.output_csv}")


if __name__ == "__main__":
    main()
