# Benchmark Dataset Layout

This document defines the dataset folder convention for benchmark runs.

Required folders:
- benchmark_dataset/image/real
- benchmark_dataset/image/ai
- benchmark_dataset/video/real
- benchmark_dataset/video/ai
- benchmark_dataset/audio/real
- benchmark_dataset/audio/ai

Label mapping:
- real = 0
- ai = 1

Determinism requirements:
- The batch runner must traverse files in sorted path order.
- Sorting should use each file path relative to the dataset root.

Sample tree:
```text
benchmark_dataset/
  image/
    real/
      real_0001.jpg
      real_0002.png
    ai/
      ai_0001.png
  video/
    real/
    ai/
  audio/
    real/
    ai/
```

Purpose:
- Dataset layout for `scripts/run_benchmark.py` inputs.

Allowed extensions (examples):
- Image: `.jpg`, `.jpeg`, `.png`, `.webp`
- Video: `.mp4`, `.mov`, `.mkv`
- Audio: `.wav`, `.mp3`, `.flac`

How to start:
```bash
python scripts/run_benchmark.py --dataset-root benchmark_dataset --media all --output-csv data/benchmark_results.csv --threshold 0.5
python scripts/benchmark_report.py --input-csv data/benchmark_results.csv --output-json data/benchmark_report.json --threshold 0.5 --media all --export-errors true --threshold-sweep true --sweep-min 0.0 --sweep-max 1.0 --sweep-step 0.05
```
