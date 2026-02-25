import argparse
import csv
import json
from datetime import datetime
from pathlib import Path

from Backend.benchmark_metrics import (
    load_results_csv,
    compute_binary_metrics,
    split_errors,
    rank_worst_errors,
    compute_roc_auc,
    optimize_thresholds,
)


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "no", "n", "off"}:
        return False
    raise argparse.ArgumentTypeError(f"invalid boolean value: {value}")


def _iter_thresholds(min_value, max_value, step):
    min_value = float(min_value)
    max_value = float(max_value)
    step = float(step)
    if step <= 0:
        raise ValueError("sweep-step must be > 0")
    current = min_value
    while current <= max_value + 1e-9:
        yield round(current, 6)
        current += step


def _media_list(media_arg):
    if media_arg == "all":
        return ["image", "video", "audio"]
    return [media_arg]


def _error_row(row):
    return {
        "filename": row.get("filename"),
        "media_type": row.get("media_type"),
        "true_label": row.get("true_label"),
        "ai_score_percent": row.get("ai_score_percent"),
        "confidence": row.get("confidence"),
        "conflict": row.get("conflict"),
    }


def _write_error_csv(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "filename",
        "media_type",
        "true_label",
        "ai_score_percent",
        "confidence",
        "conflict",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(_error_row(row))


def _normalize_top_k(value, default=50):
    try:
        value = int(value)
    except Exception:
        return int(default)
    if value < 0:
        return 0
    return value


def _format_metrics_lines(metrics: dict):
    ordered_keys = [
        "accuracy",
        "precision",
        "recall",
        "f1",
        "fpr",
        "fnr",
        "tp",
        "fp",
        "tn",
        "fn",
        "total",
    ]
    lines = []
    for key in ordered_keys:
        lines.append(f"{key}: {metrics.get(key)}")
    return lines


def _format_worst_lines(rows, limit=10):
    if not rows:
        return ["None"]
    lines = []
    for idx, row in enumerate(rows[:limit], start=1):
        filename = row.get("filename") or ""
        score = row.get("ai_score_percent")
        media = row.get("media_type")
        if media:
            lines.append(f"{idx}. {filename} (score={score}, media={media})")
        else:
            lines.append(f"{idx}. {filename} (score={score})")
    return lines


def _format_threshold_entry(label, entry, metric_keys, target=None):
    if not entry or entry.get("threshold") is None:
        if target is not None:
            return f"{label} (target={target}): None"
        return f"{label}: None"
    metrics = entry.get("metrics") or {}
    parts = ", ".join([f"{key}={metrics.get(key)}" for key in metric_keys])
    if target is not None:
        return f"{label} (target={target}): {entry.get('threshold')} ({parts})"
    return f"{label}: {entry.get('threshold')} ({parts})"


def _format_threshold_lines(recommendations):
    if not isinstance(recommendations, dict):
        return ["None"]
    best_f1 = recommendations.get("best_f1")
    fpr_limited = recommendations.get("fpr_limited")
    lines = [
        _format_threshold_entry("best_f1", best_f1, ["f1", "recall", "fpr"]),
        _format_threshold_entry(
            "fpr_limited",
            fpr_limited,
            ["recall", "fpr"],
            target=fpr_limited.get("fpr_target") if isinstance(fpr_limited, dict) else None,
        ),
    ]
    return lines


def _write_summary(path: Path, report: dict, media_arg: str, worst_fp, worst_fn):
    lines = []
    lines.append("**Benchmark Summary**")
    lines.append(f"Generated at (UTC): {report.get('generated_at')}")
    lines.append(f"Threshold: {report.get('threshold')}")
    lines.append(f"Media: {report.get('media')}")
    lines.append("")
    lines.append("**OK Rows**")
    for media in _media_list(media_arg):
        metrics = report.get("per_media", {}).get(media)
        if metrics is None:
            continue
        lines.append(f"{media}: {metrics.get('total', 0)}")
    lines.append("")
    lines.append("**Metrics (overall)**")
    lines.extend(_format_metrics_lines(report.get("overall", {})))
    lines.append("")
    for media in _media_list(media_arg):
        metrics = report.get("per_media", {}).get(media)
        if metrics is None:
            continue
        lines.append(f"**Metrics ({media})**")
        lines.extend(_format_metrics_lines(metrics))
        lines.append("")
    lines.append("**ROC-AUC**")
    lines.append(f"overall: {report.get('overall', {}).get('roc_auc')}")
    for media in _media_list(media_arg):
        metrics = report.get("per_media", {}).get(media)
        if metrics is None:
            continue
        lines.append(f"{media}: {metrics.get('roc_auc')}")
    lines.append("")
    lines.append("**Recommended Thresholds (overall)**")
    lines.extend(_format_threshold_lines(report.get("overall", {}).get("threshold_recommendations")))
    lines.append("")
    for media in _media_list(media_arg):
        metrics = report.get("per_media", {}).get(media)
        if metrics is None:
            continue
        lines.append(f"**Recommended Thresholds ({media})**")
        lines.extend(_format_threshold_lines(metrics.get("threshold_recommendations")))
        lines.append("")
    lines.append("**Top 10 Worst False Positives**")
    lines.extend(_format_worst_lines(worst_fp, limit=10))
    lines.append("")
    lines.append("**Top 10 Worst False Negatives**")
    lines.extend(_format_worst_lines(worst_fn, limit=10))
    lines.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def _build_report(rows, threshold, media_arg, threshold_step=0.01, fpr_target=0.10, recommend_thresholds=True):
    overall = compute_binary_metrics(rows, threshold)
    overall["roc_auc"] = compute_roc_auc(rows)
    overall["threshold_recommendations"] = (
        optimize_thresholds(rows, step=threshold_step, fpr_target=fpr_target)
        if recommend_thresholds
        else None
    )
    report = {
        "input_rows": len(rows or []),
        "threshold": float(threshold),
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "media": media_arg,
        "overall": overall,
        "per_media": {},
    }
    for media in _media_list(media_arg):
        metrics = compute_binary_metrics(rows, threshold, media_type=media)
        metrics["roc_auc"] = compute_roc_auc(rows, media_type=media)
        metrics["threshold_recommendations"] = (
            optimize_thresholds(rows, media_type=media, step=threshold_step, fpr_target=fpr_target)
            if recommend_thresholds
            else None
        )
        report["per_media"][media] = metrics
    return report


def _write_threshold_sweep(path: Path, rows, media_arg, sweep_min, sweep_max, sweep_step):
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "threshold",
        "media_type",
        "accuracy",
        "precision",
        "recall",
        "f1",
        "fpr",
        "fnr",
        "tp",
        "fp",
        "tn",
        "fn",
        "total",
    ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for threshold in _iter_thresholds(sweep_min, sweep_max, sweep_step):
            overall = compute_binary_metrics(rows, threshold)
            writer.writerow({"threshold": threshold, "media_type": "all", **overall})
            for media in _media_list(media_arg):
                metrics = compute_binary_metrics(rows, threshold, media_type=media)
                writer.writerow({"threshold": threshold, "media_type": media, **metrics})


def main():
    parser = argparse.ArgumentParser(description="Generate benchmark metrics report.")
    parser.add_argument("--input-csv", default="data/benchmark_results.csv")
    parser.add_argument("--output-json", default="data/benchmark_report.json")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--media", default="all", choices=["image", "video", "audio", "all"])
    parser.add_argument("--export-errors", type=_parse_bool, default=True)
    parser.add_argument("--errors-dir", default="data")
    parser.add_argument("--threshold-step", type=float, default=0.01)
    parser.add_argument("--fpr-target", type=float, default=0.10)
    parser.add_argument("--recommend-thresholds", type=_parse_bool, default=True)
    parser.add_argument("--top-k", type=int, default=50)
    parser.add_argument("--export-worst", type=_parse_bool, default=True)
    parser.add_argument("--worst-dir", default="data")
    parser.add_argument("--threshold-sweep", type=_parse_bool, default=False)
    parser.add_argument("--sweep-min", type=float, default=0.0)
    parser.add_argument("--sweep-max", type=float, default=1.0)
    parser.add_argument("--sweep-step", type=float, default=0.05)
    args = parser.parse_args()

    rows = load_results_csv(args.input_csv)
    report = _build_report(
        rows,
        args.threshold,
        args.media,
        threshold_step=args.threshold_step,
        fpr_target=args.fpr_target,
        recommend_thresholds=args.recommend_thresholds,
    )

    output_json = Path(args.output_json)
    output_json.parent.mkdir(parents=True, exist_ok=True)
    with output_json.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    if args.export_errors:
        false_pos, false_neg = split_errors(
            rows, args.threshold, media_type=None if args.media == "all" else args.media
        )
        errors_dir = Path(args.errors_dir)
        _write_error_csv(errors_dir / "errors_false_positive.csv", false_pos)
        _write_error_csv(errors_dir / "errors_false_negative.csv", false_neg)

    top_k = _normalize_top_k(args.top_k)
    if args.export_worst:
        worst_dir = Path(args.worst_dir)
        rank_k = max(top_k, 10)
        worst_fp, worst_fn = rank_worst_errors(
            rows,
            args.threshold,
            media_type=None if args.media == "all" else args.media,
            top_k=rank_k,
        )
        _write_error_csv(worst_dir / "worst_false_positive.csv", worst_fp[:top_k])
        _write_error_csv(worst_dir / "worst_false_negative.csv", worst_fn[:top_k])
        if args.media == "all":
            for media in _media_list(args.media):
                media_fp, media_fn = rank_worst_errors(
                    rows, args.threshold, media_type=media, top_k=top_k
                )
                _write_error_csv(
                    worst_dir / f"worst_false_positive_{media}.csv", media_fp
                )
                _write_error_csv(
                    worst_dir / f"worst_false_negative_{media}.csv", media_fn
                )
        _write_summary(
            worst_dir / "benchmark_summary.md",
            report,
            args.media,
            worst_fp,
            worst_fn,
        )

    if args.threshold_sweep:
        sweep_path = Path(args.errors_dir) / "threshold_sweep.csv"
        _write_threshold_sweep(
            sweep_path, rows, args.media, args.sweep_min, args.sweep_max, args.sweep_step
        )


if __name__ == "__main__":
    main()
