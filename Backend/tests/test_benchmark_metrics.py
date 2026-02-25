import csv

from Backend import benchmark_metrics


def test_compute_metrics_and_split_errors():
    rows = [
        {
            "filename": "img_tp.png",
            "media_type": "image",
            "true_label": "1",
            "ai_score_percent": "90",
            "confidence": "80",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "img_tn.png",
            "media_type": "image",
            "true_label": "0",
            "ai_score_percent": "10",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "img_fp.png",
            "media_type": "image",
            "true_label": "0",
            "ai_score_percent": "80",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "img_fn.png",
            "media_type": "image",
            "true_label": "1",
            "ai_score_percent": "20",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "img_err.png",
            "media_type": "image",
            "true_label": "1",
            "ai_score_percent": "99",
            "confidence": "99",
            "conflict": "",
            "status": "error",
        },
        {
            "filename": "vid_tp.mp4",
            "media_type": "video",
            "true_label": "1",
            "ai_score_percent": "90",
            "confidence": "70",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "missing_score.png",
            "media_type": "image",
            "true_label": "1",
            "ai_score_percent": "",
            "confidence": "70",
            "conflict": "",
            "status": "ok",
        },
    ]

    metrics = benchmark_metrics.compute_binary_metrics(rows, 0.5, media_type="image")
    assert metrics["tp"] == 1
    assert metrics["tn"] == 1
    assert metrics["fp"] == 1
    assert metrics["fn"] == 1
    assert metrics["accuracy"] == 0.5
    assert metrics["precision"] == 0.5
    assert metrics["recall"] == 0.5
    assert metrics["f1"] == 0.5
    assert metrics["fpr"] == 0.5
    assert metrics["fnr"] == 0.5

    false_pos, false_neg = benchmark_metrics.split_errors(rows, 0.5, media_type="image")
    assert len(false_pos) == 1
    assert len(false_neg) == 1


def test_load_results_csv(tmp_path):
    csv_path = tmp_path / "results.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "filename",
                "media_type",
                "true_label",
                "ai_score_percent",
                "confidence",
                "conflict",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "filename": "sample.png",
                "media_type": "image",
                "true_label": "0",
                "ai_score_percent": "12.5",
                "confidence": "50",
                "conflict": "",
                "status": "ok",
            }
        )

    rows = benchmark_metrics.load_results_csv(str(csv_path))
    assert len(rows) == 1
    assert rows[0]["filename"] == "sample.png"
