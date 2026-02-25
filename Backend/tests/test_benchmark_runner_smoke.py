import csv

from Backend.engines.engine_utils import make_engine_result
from scripts import run_benchmark as benchmark


MIN_PNG = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\x0bIDATx\x9cc`\x00\x00\x00\x02\x00\x01"
    b"\xe2!\xbc\x33"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _stub_run_ensemble(_path):
    return {
        "ok": True,
        "engine_results_raw": [
            make_engine_result(
                engine="forensics",
                status="ok",
                notes="ok",
                available=True,
                ai_likelihood=0.2,
                confidence=0.8,
                signals=["stub"],
                timing_ms=1,
            )
        ],
    }


def test_benchmark_runner_smoke(tmp_path, monkeypatch):
    dataset_root = tmp_path / "benchmark_dataset"
    real_dir = dataset_root / "image" / "real"
    ai_dir = dataset_root / "image" / "ai"
    real_dir.mkdir(parents=True)
    ai_dir.mkdir(parents=True)

    (real_dir / "real_1.png").write_bytes(MIN_PNG)
    (ai_dir / "ai_1.png").write_bytes(MIN_PNG)

    output_csv = tmp_path / "results.csv"

    monkeypatch.setattr(benchmark, "run_ensemble", _stub_run_ensemble)

    processed = benchmark.run_benchmark(
        dataset_root=str(dataset_root),
        media="image",
        output_csv=str(output_csv),
        threshold=0.5,
    )

    assert processed == 2
    assert output_csv.exists()

    with output_csv.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    assert rows
    for column in benchmark.CSV_COLUMNS:
        assert column in rows[0]
