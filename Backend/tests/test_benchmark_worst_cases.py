from Backend import benchmark_metrics


def test_rank_worst_errors_sorting_and_ties():
    rows = [
        {
            "filename": "fp_high.png",
            "media_type": "image",
            "true_label": "0",
            "ai_score_percent": "95",
            "confidence": "80",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "fp_mid.png",
            "media_type": "video",
            "true_label": "0",
            "ai_score_percent": "70",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "fp_same_a.png",
            "media_type": "audio",
            "true_label": "0",
            "ai_score_percent": "70",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "fp_same_b.png",
            "media_type": "audio",
            "true_label": "0",
            "ai_score_percent": "70",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "fn_low.png",
            "media_type": "image",
            "true_label": "1",
            "ai_score_percent": "5",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "fn_same_a.png",
            "media_type": "audio",
            "true_label": "1",
            "ai_score_percent": "10",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "fn_same_b.png",
            "media_type": "audio",
            "true_label": "1",
            "ai_score_percent": "10",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "fn_mid.png",
            "media_type": "video",
            "true_label": "1",
            "ai_score_percent": "40",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "tp.png",
            "media_type": "image",
            "true_label": "1",
            "ai_score_percent": "90",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "tn.png",
            "media_type": "image",
            "true_label": "0",
            "ai_score_percent": "10",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
        {
            "filename": "bad_status.png",
            "media_type": "image",
            "true_label": "0",
            "ai_score_percent": "99",
            "confidence": "60",
            "conflict": "",
            "status": "error",
        },
        {
            "filename": "missing_score.png",
            "media_type": "image",
            "true_label": "0",
            "ai_score_percent": "",
            "confidence": "60",
            "conflict": "",
            "status": "ok",
        },
    ]

    worst_fp, worst_fn = benchmark_metrics.rank_worst_errors(rows, 0.5, top_k=10)

    assert [row["filename"] for row in worst_fp] == [
        "fp_high.png",
        "fp_mid.png",
        "fp_same_a.png",
        "fp_same_b.png",
    ]
    assert [row["filename"] for row in worst_fn] == [
        "fn_low.png",
        "fn_same_a.png",
        "fn_same_b.png",
        "fn_mid.png",
    ]

    required_keys = {
        "filename",
        "media_type",
        "true_label",
        "ai_score_percent",
        "confidence",
        "conflict",
    }
    for row in worst_fp + worst_fn:
        assert required_keys.issubset(row.keys())
