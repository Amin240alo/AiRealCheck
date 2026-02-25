#!/usr/bin/env python
import argparse
import json
import os
from datetime import datetime, timezone

from Backend import learned_weights


def _write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")


def _format_metric(value):
    if value is None:
        return "n/a"
    return f"{value:.4f}"


def _write_report(path, report, meta):
    lines = []
    lines.append("# Learned Ensemble Weights Report")
    lines.append("")
    lines.append(f"- Generated: {meta['generated_at']}")
    lines.append(f"- Seed: {meta['seed']}")
    lines.append(f"- Folds: {meta['folds']}")
    lines.append(f"- Samples: {meta['samples']}")
    lines.append("")
    for media_type, info in report.items():
        metrics = info.get("metrics", {})
        lines.append(f"## {media_type.title()}")
        lines.append(f"- Samples: {info.get('samples', 0)}")
        lines.append(f"- Engines: {', '.join(info.get('engines', [])) or 'n/a'}")
        lines.append("- Metrics:")
        lines.append(f"  - Log loss: {_format_metric(metrics.get('log_loss'))}")
        lines.append(f"  - Accuracy: {_format_metric(metrics.get('accuracy'))}")
        lines.append(f"  - F1: {_format_metric(metrics.get('f1'))}")
        lines.append(f"  - ROC-AUC: {_format_metric(metrics.get('roc_auc'))}")
        lines.append("")
        lines.append("Weights:")
        for engine, weight in sorted(info.get("weights", {}).items()):
            lines.append(f"- {engine}: {weight:.4f}")
        lines.append("")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines).strip() + "\n")


def main():
    parser = argparse.ArgumentParser(description="Train learned ensemble weights.")
    parser.add_argument(
        "--input",
        default="data/labeled_samples.example.jsonl",
        help="Path to labeled samples JSONL.",
    )
    parser.add_argument(
        "--output",
        default="data/learned_weights.json",
        help="Output path for learned weights JSON.",
    )
    parser.add_argument(
        "--report",
        default="data/learned_weights_report.md",
        help="Output path for training report markdown.",
    )
    parser.add_argument("--seed", type=int, default=learned_weights.DEFAULT_SEED)
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--max-iter", type=int, default=500)
    parser.add_argument("--lr", type=float, default=0.3)
    args = parser.parse_args()

    samples = learned_weights.load_labeled_samples(args.input)
    weights, report = learned_weights.train_ensemble_weights(
        samples, seed=args.seed, k=args.k, max_iter=args.max_iter, lr=args.lr
    )
    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "seed": args.seed,
        "folds": args.k,
        "samples": len(samples),
    }
    payload = dict(weights)
    payload["_meta"] = meta
    _write_json(args.output, payload)
    _write_report(args.report, report, meta)


if __name__ == "__main__":
    main()
