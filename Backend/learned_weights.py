import json
import math
from typing import Dict, List, Optional, Tuple

import numpy as np

DEFAULT_SEED = 42


def normalize_ai01(value) -> Optional[float]:
    if value is None:
        return None
    try:
        v = float(value)
    except Exception:
        return None
    if v < 0.0:
        v = 0.0
    if v > 1.0:
        v = v / 100.0 if v <= 100.0 else 1.0
    if v > 1.0:
        v = 1.0
    return v


def load_labeled_samples(path: str) -> List[dict]:
    samples: List[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for line_no, raw in enumerate(f, start=1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if not isinstance(obj, dict):
                continue
            media_type = obj.get("media_type")
            if media_type not in {"image", "video", "audio"}:
                continue
            label_raw = obj.get("label")
            if isinstance(label_raw, bool):
                label = 1 if label_raw else 0
            else:
                try:
                    label = int(label_raw)
                except Exception:
                    continue
            if label not in {0, 1}:
                continue
            engine_ai = obj.get("engine_ai")
            if not isinstance(engine_ai, dict):
                engine_ai = {}
            normalized = {}
            for name, val in engine_ai.items():
                if name is None:
                    continue
                norm = normalize_ai01(val)
                if norm is None:
                    continue
                normalized[str(name)] = norm
            sample_id = obj.get("id") or f"row-{line_no}"
            samples.append(
                {
                    "id": str(sample_id),
                    "media_type": media_type,
                    "label": label,
                    "engine_ai": normalized,
                }
            )
    return samples


def _softmax(z: np.ndarray) -> np.ndarray:
    z = z - np.max(z)
    exp = np.exp(z)
    denom = np.sum(exp)
    if denom <= 0:
        return np.ones_like(z) / float(len(z))
    return exp / denom


def _build_matrix(samples: List[dict], engines: List[str]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    n = len(samples)
    m = len(engines)
    x = np.full((n, m), np.nan, dtype=np.float64)
    y = np.zeros((n,), dtype=np.float64)
    for i, sample in enumerate(samples):
        y[i] = float(sample.get("label", 0))
        engine_ai = sample.get("engine_ai") if isinstance(sample.get("engine_ai"), dict) else {}
        for j, engine in enumerate(engines):
            if engine in engine_ai:
                x[i, j] = float(engine_ai[engine])
    mask = ~np.isnan(x)
    x = np.nan_to_num(x, nan=0.0)
    return x, y, mask


def _predict(weights: np.ndarray, x: np.ndarray, mask: np.ndarray) -> np.ndarray:
    w = weights.reshape((1, -1))
    w_masked = w * mask
    denom = np.sum(w_masked, axis=1)
    numer = np.sum(w_masked * x, axis=1)
    preds = np.full((x.shape[0],), np.nan, dtype=np.float64)
    valid = denom > 0
    preds[valid] = numer[valid] / denom[valid]
    return preds


def _loss_and_grad(
    z: np.ndarray, x: np.ndarray, y: np.ndarray, mask: np.ndarray, eps: float = 1e-9
) -> Tuple[Optional[float], Optional[np.ndarray], int]:
    w = _softmax(z)
    preds = _predict(w, x, mask)
    valid = ~np.isnan(preds)
    if not np.any(valid):
        return None, None, 0
    p = np.clip(preds[valid], eps, 1.0 - eps)
    yv = y[valid]
    loss = -np.mean((yv * np.log(p)) + ((1.0 - yv) * np.log(1.0 - p)))

    g_w = np.zeros_like(w)
    count = 0
    for i in range(x.shape[0]):
        if math.isnan(preds[i]):
            continue
        p_i = float(np.clip(preds[i], eps, 1.0 - eps))
        y_i = float(y[i])
        denom = float(np.sum(w * mask[i]))
        if denom <= 0:
            continue
        dL_dp = (p_i - y_i) / (p_i * (1.0 - p_i))
        dp_dw = mask[i] * (x[i] - p_i) / denom
        g_w += dL_dp * dp_dw
        count += 1
    if count <= 0:
        return loss, None, 0
    g_w = g_w / float(count)
    g_z = w * (g_w - float(np.dot(g_w, w)))
    return loss, g_z, count


def _optimize_weights(
    x: np.ndarray,
    y: np.ndarray,
    mask: np.ndarray,
    max_iter: int = 500,
    lr: float = 0.3,
    tol: float = 1e-6,
) -> np.ndarray:
    z = np.zeros((x.shape[1],), dtype=np.float64)
    prev_loss = None
    for _ in range(max_iter):
        loss, grad, count = _loss_and_grad(z, x, y, mask)
        if loss is None or grad is None or count == 0:
            break
        z = z - (lr * grad)
        if prev_loss is not None and abs(prev_loss - loss) < tol:
            break
        prev_loss = loss
    return _softmax(z)


def _roc_auc(y_true: np.ndarray, y_score: np.ndarray) -> Optional[float]:
    y_true = y_true.astype(int)
    positives = y_true == 1
    negatives = y_true == 0
    n_pos = int(np.sum(positives))
    n_neg = int(np.sum(negatives))
    if n_pos == 0 or n_neg == 0:
        return None
    scores = y_score.astype(np.float64)
    order = np.argsort(scores)
    ranks = np.empty_like(order, dtype=np.float64)
    i = 0
    while i < len(scores):
        j = i
        while j + 1 < len(scores) and scores[order[j + 1]] == scores[order[i]]:
            j += 1
        rank = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[order[k]] = rank
        i = j + 1
    rank_sum = float(np.sum(ranks[positives]))
    auc = (rank_sum - (n_pos * (n_pos + 1) / 2.0)) / float(n_pos * n_neg)
    return auc


def _compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    valid = ~np.isnan(y_pred)
    if not np.any(valid):
        return {
            "count": 0,
            "log_loss": None,
            "accuracy": None,
            "f1": None,
            "roc_auc": None,
        }
    yt = y_true[valid]
    yp = np.clip(y_pred[valid], 1e-9, 1.0 - 1e-9)
    yhat = (yp >= 0.5).astype(int)
    accuracy = float(np.mean(yhat == yt))

    tp = int(np.sum((yhat == 1) & (yt == 1)))
    fp = int(np.sum((yhat == 1) & (yt == 0)))
    fn = int(np.sum((yhat == 0) & (yt == 1)))
    precision = tp / float(tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / float(tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 0.0 if (precision + recall) == 0 else (2.0 * precision * recall) / (precision + recall)

    log_loss = float(-np.mean((yt * np.log(yp)) + ((1.0 - yt) * np.log(1.0 - yp))))
    roc_auc = _roc_auc(yt, yp)
    return {
        "count": int(len(yt)),
        "log_loss": log_loss,
        "accuracy": accuracy,
        "f1": f1,
        "roc_auc": roc_auc,
    }


def train_media_weights(
    samples: List[dict],
    seed: int = DEFAULT_SEED,
    k: int = 5,
    max_iter: int = 500,
    lr: float = 0.3,
) -> dict:
    engines = sorted({name for sample in samples for name in sample.get("engine_ai", {}).keys()})
    if not engines:
        return {
            "weights": {},
            "engines": [],
            "metrics": {},
            "folds": [],
            "samples": len(samples),
        }
    x, y, mask = _build_matrix(samples, engines)
    n = x.shape[0]
    if n <= 0:
        return {
            "weights": {},
            "engines": engines,
            "metrics": {},
            "folds": [],
            "samples": 0,
        }
    fold_count = min(max(1, k), n)
    rng = np.random.default_rng(seed)
    indices = np.arange(n)
    rng.shuffle(indices)
    folds = np.array_split(indices, fold_count)

    fold_metrics = []
    if fold_count > 1:
        for i in range(fold_count):
            val_idx = folds[i]
            train_idx = np.concatenate([folds[j] for j in range(fold_count) if j != i])
            w = _optimize_weights(x[train_idx], y[train_idx], mask[train_idx], max_iter=max_iter, lr=lr)
            preds = _predict(w, x[val_idx], mask[val_idx])
            fold_metrics.append(_compute_metrics(y[val_idx], preds))
    else:
        w = _optimize_weights(x, y, mask, max_iter=max_iter, lr=lr)
        preds = _predict(w, x, mask)
        fold_metrics.append(_compute_metrics(y, preds))

    final_w = _optimize_weights(x, y, mask, max_iter=max_iter, lr=lr)
    weights = {engine: float(final_w[idx]) for idx, engine in enumerate(engines)}

    def _avg(metric):
        values = [m.get(metric) for m in fold_metrics if m.get(metric) is not None]
        return float(np.mean(values)) if values else None

    metrics = {
        "log_loss": _avg("log_loss"),
        "accuracy": _avg("accuracy"),
        "f1": _avg("f1"),
        "roc_auc": _avg("roc_auc"),
        "folds": len(fold_metrics),
        "samples": n,
    }
    return {
        "weights": weights,
        "engines": engines,
        "metrics": metrics,
        "folds": fold_metrics,
        "samples": n,
    }


def train_ensemble_weights(
    samples: List[dict],
    seed: int = DEFAULT_SEED,
    k: int = 5,
    max_iter: int = 500,
    lr: float = 0.3,
) -> Tuple[Dict[str, Dict[str, float]], Dict[str, dict]]:
    grouped: Dict[str, List[dict]] = {"image": [], "video": [], "audio": []}
    for sample in samples:
        media_type = sample.get("media_type")
        if media_type in grouped:
            grouped[media_type].append(sample)
    weights_out: Dict[str, Dict[str, float]] = {}
    report: Dict[str, dict] = {}
    for media_type, items in grouped.items():
        if not items:
            continue
        result = train_media_weights(items, seed=seed, k=k, max_iter=max_iter, lr=lr)
        weights_out[media_type] = result.get("weights", {})
        report[media_type] = result
    return weights_out, report
