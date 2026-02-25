# Ensemble Weights Dataset Spec

## JSONL Schema
Each line is a JSON object with the following minimal schema:

```json
{
  "id": "sample-123",
  "media_type": "image" | "video" | "audio",
  "label": 0 | 1,
  "engine_ai": {
    "xception": 0.72,
    "hive": 0.90
  }
}
```

Notes:
- `label`: `1` means AI/fake, `0` means real.
- `engine_ai` values may be in `0..1` or `0..100`.
- Missing engines are allowed and treated as missing values.
- Lines may include extra fields; they are ignored by the loader.

## Normalization Rules
`engine_ai` values are normalized to `0..1`:
- If value > 1 and <= 100, it is divided by 100.
- If value > 100, it is clamped to 1.
- Negative values are clamped to 0.

## Runtime Precedence (Weights)
When `AIREALCHECK_ENABLE_LEARNED_WEIGHTS=true`, learned weights are applied per media type.  
Precedence order is:
1. Manual JSON override (existing env: `AIREALCHECK_*_ENGINE_WEIGHTS_JSON`)
2. Learned weights file (`AIREALCHECK_LEARNED_WEIGHTS_PATH`)
3. Built-in defaults (`ENGINE_WEIGHTS`)
