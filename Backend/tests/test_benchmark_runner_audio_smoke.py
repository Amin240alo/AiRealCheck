import csv

from scripts import run_benchmark as benchmark


def _stub_run_audio_analysis(_file_path, _filename):
    return {
        "ok": True,
        "ai_likelihood": 64.2,
        "confidence": 0.6,
        "conflict": False,
    }


def test_benchmark_runner_audio_smoke(tmp_path, monkeypatch):
    dataset_root = tmp_path / "benchmark_dataset"
    real_dir = dataset_root / "audio" / "real"
    ai_dir = dataset_root / "audio" / "ai"
    real_dir.mkdir(parents=True)
    ai_dir.mkdir(parents=True)

    (real_dir / "real_1.wav").write_bytes(b"0")
    (ai_dir / "ai_1.wav").write_bytes(b"0")

    output_csv = tmp_path / "results.csv"

    monkeypatch.setattr(benchmark, "_run_audio_analysis", _stub_run_audio_analysis)

    processed = benchmark.run_benchmark(
        dataset_root=str(dataset_root),
        media="audio",
        output_csv=str(output_csv),
        threshold=0.5,
    )

    assert processed == 2
    assert output_csv.exists()

    with output_csv.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    assert len(rows) == 2
    for column in benchmark.CSV_COLUMNS:
        assert column in rows[0]
