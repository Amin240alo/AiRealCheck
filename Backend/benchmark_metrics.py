import csv
from typing import Iterable, List, Tuple


def load_results_csv(path: str) -> List[dict]:
    with open(path, "r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _to_float(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        return float(text)
    except Exception:
        return None


def _to_int(value):
    if value is None:
        return None
    if isinstance(value, int):
        return int(value)
    try:
        return int(str(value).strip())
    except Exception:
        return None


def _normalize_row(row: dict):
    if not isinstance(row, dict):
        return None
    status = str(row.get("status") or "").strip().lower()
    media_type = str(row.get("media_type") or "").strip().lower()
    ai_score = _to_float(row.get("ai_score_percent"))
    true_label = _to_int(row.get("true_label"))
    confidence = _to_float(row.get("confidence"))
    conflict = row.get("conflict")
    filename = row.get("filename")
    return {
        "status": status,
        "media_type": media_type,
        "ai_score_percent": ai_score,
        "true_label": true_label,
        "confidence": confidence,
        "conflict": conflict,
        "filename": filename,
        "raw": row,
    }


def _iter_valid_rows(rows: Iterable[dict], media_type=None):
    media_filter = str(media_type).strip().lower() if media_type else None
    for row in rows or []:
        normalized = _normalize_row(row)
        if not normalized:
            continue
        if normalized["status"] != "ok":
            continue
        if normalized["ai_score_percent"] is None:
            continue
        if normalized["true_label"] not in (0, 1):
            continue
        if media_filter and normalized["media_type"] != media_filter:
            continue
        yield normalized


def _error_payload(row: dict) -> dict:
    return {
        "filename": row.get("filename"),
        "media_type": row.get("media_type"),
        "true_label": row.get("true_label"),
        "ai_score_percent": row.get("ai_score_percent"),
        "confidence": row.get("confidence"),
        "conflict": row.get("conflict"),
    }


def _safe_div(num, denom):
    if denom <= 0:
        return 0.0
    return num / denom


def _iter_thresholds(min_value, max_value, step):
    min_value = float(min_value)
    max_value = float(max_value)
    step = float(step)
    if step <= 0:
        raise ValueError("step must be > 0")
    idx = 0
    while True:
        value = min_value + (idx * step)
        if value > max_value + 1e-9:
            break
        yield round(value, 6)
        idx += 1


def compute_binary_metrics(rows: Iterable[dict], threshold: float, media_type=None) -> dict:
    tp = fp = tn = fn = 0
    for row in _iter_valid_rows(rows, media_type=media_type):
        ai_score = float(row["ai_score_percent"])
        predicted = 1 if (ai_score / 100.0) >= float(threshold) else 0
        true_label = int(row["true_label"])
        if predicted == 1 and true_label == 1:
            tp += 1
        elif predicted == 1 and true_label == 0:
            fp += 1
        elif predicted == 0 and true_label == 0:
            tn += 1
        elif predicted == 0 and true_label == 1:
            fn += 1

    total = tp + fp + tn + fn
    accuracy = _safe_div(tp + tn, total)
    precision = _safe_div(tp, tp + fp)
    recall = _safe_div(tp, tp + fn)
    f1 = _safe_div(2 * precision * recall, precision + recall)
    fpr = _safe_div(fp, fp + tn)
    fnr = _safe_div(fn, fn + tp)
    return {
        "threshold": float(threshold),
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "fpr": fpr,
        "fnr": fnr,
        "tp": tp,
        "fp": fp,
        "tn": tn,
        "fn": fn,
        "total": total,
    }


def split_errors(rows: Iterable[dict], threshold: float, media_type=None) -> Tuple[List[dict], List[dict]]:
    false_pos = []
    false_neg = []
    for row in _iter_valid_rows(rows, media_type=media_type):
        ai_score = float(row["ai_score_percent"])
        predicted = 1 if (ai_score / 100.0) >= float(threshold) else 0
        true_label = int(row["true_label"])
        if predicted == 1 and true_label == 0:
            false_pos.append(row)
        elif predicted == 0 and true_label == 1:
            false_neg.append(row)
    return false_pos, false_neg


def compute_roc_auc(rows: Iterable[dict], media_type=None):
    scored = []
    pos_count = 0
    neg_count = 0
    for row in _iter_valid_rows(rows, media_type=media_type):
        score = float(row["ai_score_percent"])
        label = int(row["true_label"])
        filename = row.get("filename")
        scored.append((score, label, "" if filename is None else str(filename)))
        if label == 1:
            pos_count += 1
        else:
            neg_count += 1

    if pos_count < 1 or neg_count < 1:
        return None

    scored.sort(key=lambda item: (item[0], item[2]))

    ranks = [0.0] * len(scored)
    i = 0
    rank = 1
    while i < len(scored):
        j = i + 1
        while j < len(scored) and scored[j][0] == scored[i][0]:
            j += 1
        avg_rank = (rank + (rank + (j - i) - 1)) / 2.0
        for k in range(i, j):
            ranks[k] = avg_rank
        rank += (j - i)
        i = j

    sum_pos_ranks = 0.0
    for idx, (_score, label, _name) in enumerate(scored):
        if label == 1:
            sum_pos_ranks += ranks[idx]

    u_value = sum_pos_ranks - (pos_count * (pos_count + 1) / 2.0)
    return u_value / float(pos_count * neg_count)


def optimize_thresholds(
    rows: Iterable[dict],
    media_type=None,
    step=0.01,
    fpr_target=0.10,
) -> dict:
    thresholds = list(_iter_thresholds(0.0, 1.0, step))
    metrics_by_threshold = []
    for threshold in thresholds:
        metrics = compute_binary_metrics(rows, threshold, media_type=media_type)
        metrics_by_threshold.append((threshold, metrics))

    def _select_best(key_func):
        best = None
        best_key = None
        for threshold, metrics in metrics_by_threshold:
            key = key_func(threshold, metrics)
            if best_key is None or key < best_key:
                best_key = key
                best = (threshold, metrics)
        return best

    best_f1 = _select_best(
        lambda threshold, metrics: (
            -float(metrics.get("f1", 0.0)),
            float(metrics.get("fpr", 0.0)),
            -float(metrics.get("recall", 0.0)),
            float(threshold),
        )
    )

    best_precision = _select_best(
        lambda threshold, metrics: (
            -float(metrics.get("precision", 0.0)),
            -float(metrics.get("recall", 0.0)),
            float(metrics.get("fpr", 0.0)),
            -float(threshold),
        )
    )

    fpr_target = float(fpr_target)
    fpr_candidates = []
    for threshold, metrics in metrics_by_threshold:
        if float(metrics.get("fpr", 0.0)) <= fpr_target + 1e-12:
            fpr_candidates.append((threshold, metrics))

    fpr_limited = None
    if fpr_candidates:
        fpr_limited = min(
            fpr_candidates,
            key=lambda item: (
                float(item[0]),
                -float(item[1].get("recall", 0.0)),
            ),
        )

    def _pack(result, include_target=False):
        if not result:
            payload = {"threshold": None, "metrics": None}
        else:
            payload = {"threshold": result[0], "metrics": result[1]}
        if include_target:
            payload["fpr_target"] = fpr_target
        return payload

    return {
        "step": float(step),
        "best_f1": _pack(best_f1),
        "best_precision": _pack(best_precision),
        "fpr_limited": _pack(fpr_limited, include_target=True),
    }


def rank_worst_errors(
    rows: Iterable[dict],
    threshold: float,
    media_type=None,
    top_k=50,
) -> Tuple[List[dict], List[dict]]:
    false_pos = []
    false_neg = []
    threshold = float(threshold)
    for row in _iter_valid_rows(rows, media_type=media_type):
        ai_score = float(row["ai_score_percent"])
        predicted = 1 if (ai_score / 100.0) >= threshold else 0
        true_label = int(row["true_label"])
        if predicted == 1 and true_label == 0:
            false_pos.append(_error_payload(row))
        elif predicted == 0 and true_label == 1:
            false_neg.append(_error_payload(row))

    def _filename_key(item):
        name = item.get("filename")
        return "" if name is None else str(name)

    false_pos.sort(
        key=lambda item: (-float(item["ai_score_percent"]), _filename_key(item))
    )
    false_neg.sort(
        key=lambda item: (float(item["ai_score_percent"]), _filename_key(item))
    )

    if top_k is None:
        return false_pos, false_neg
    try:
        top_k_value = int(top_k)
    except Exception:
        top_k_value = 0
    if top_k_value <= 0:
        return [], []
    return false_pos[:top_k_value], false_neg[:top_k_value]
