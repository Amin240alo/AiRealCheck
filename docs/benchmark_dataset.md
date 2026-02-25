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
