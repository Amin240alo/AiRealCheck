from Backend import benchmark_metrics


def _row(filename, score, label, status="ok", media_type="image"):
    return {
        "filename": filename,
        "media_type": media_type,
        "true_label": str(label),
        "ai_score_percent": score,
        "confidence": "50",
        "conflict": "",
        "status": status,
    }


def test_compute_roc_auc_known_cases():
    perfect_rows = [
        _row("p1.png", "90", 1),
        _row("p2.png", "80", 1),
        _row("n1.png", "10", 0),
        _row("n2.png", "20", 0),
        _row("err.png", "50", 1, status="error"),
        _row("missing.png", "", 0),
    ]
    auc = benchmark_metrics.compute_roc_auc(perfect_rows)
    assert abs(auc - 1.0) < 1e-9

    inverted_rows = [
        _row("p1.png", "10", 1),
        _row("p2.png", "20", 1),
        _row("n1.png", "90", 0),
        _row("n2.png", "80", 0),
    ]
    auc = benchmark_metrics.compute_roc_auc(inverted_rows)
    assert abs(auc - 0.0) < 1e-9

    tied_rows = [
        _row("p1.png", "50", 1),
        _row("n1.png", "50", 0),
    ]
    auc = benchmark_metrics.compute_roc_auc(tied_rows)
    assert abs(auc - 0.5) < 1e-9

    no_neg_rows = [_row("p1.png", "50", 1)]
    assert benchmark_metrics.compute_roc_auc(no_neg_rows) is None


def test_optimize_thresholds_best_f1_tiebreaker():
    rows = [
        _row("pos_high.png", "90", 1),
        _row("pos_low.png", "40", 1),
        _row("neg_low.png", "10", 0),
        _row("neg_low2.png", "20", 0),
        _row("bad.png", "99", 0, status="error"),
        _row("missing.png", "", 0),
    ]
    result = benchmark_metrics.optimize_thresholds(rows, step=0.5, fpr_target=0.0)
    assert result["best_f1"]["threshold"] == 0.5
    assert result["best_precision"]["threshold"] == 0.5
    assert result["fpr_limited"]["threshold"] == 0.5


def test_optimize_thresholds_precision_tiebreaker():
    rows = [
        _row("pos1.png", "90", 1),
        _row("pos2.png", "60", 1),
        _row("neg1.png", "40", 0),
        _row("neg2.png", "20", 0),
    ]
    result = benchmark_metrics.optimize_thresholds(rows, step=0.25, fpr_target=0.5)
    assert result["best_precision"]["threshold"] == 0.5


def test_optimize_thresholds_fpr_limited_none():
    rows = [
        _row("pos.png", "100", 1),
        _row("neg.png", "100", 0),
    ]
    result = benchmark_metrics.optimize_thresholds(rows, step=0.5, fpr_target=0.0)
    assert result["fpr_limited"]["threshold"] is None


def test_optimize_thresholds_fpr_limited_prefers_smallest_threshold(monkeypatch):
    def _fake_metrics(_rows, threshold, media_type=None):
        recall_map = {0.0: 0.4, 0.5: 0.6, 1.0: 0.2}
        return {
            "threshold": threshold,
            "f1": 0.0,
            "precision": 0.0,
            "recall": recall_map.get(threshold, 0.0),
            "fpr": 0.05,
            "tp": 0,
            "fp": 0,
            "tn": 0,
            "fn": 0,
            "accuracy": 0.0,
            "fnr": 0.0,
            "total": 0,
        }

    monkeypatch.setattr(benchmark_metrics, "compute_binary_metrics", _fake_metrics)
    result = benchmark_metrics.optimize_thresholds([], step=0.5, fpr_target=0.1)
    assert result["fpr_limited"]["threshold"] == 0.0
