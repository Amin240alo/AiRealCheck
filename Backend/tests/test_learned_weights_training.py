import numpy as np

from Backend import learned_weights


def test_training_determinism():
    samples = [
        {"id": "s1", "media_type": "image", "label": 1, "engine_ai": {"hive": 0.9, "xception": 0.2}},
        {"id": "s2", "media_type": "image", "label": 0, "engine_ai": {"hive": 0.1, "xception": 0.8}},
        {"id": "s3", "media_type": "image", "label": 1, "engine_ai": {"hive": 0.7}},
        {"id": "s4", "media_type": "image", "label": 0, "engine_ai": {"xception": 0.3}},
    ]
    result_a = learned_weights.train_media_weights(samples, seed=123, k=2, max_iter=200, lr=0.3)
    result_b = learned_weights.train_media_weights(samples, seed=123, k=2, max_iter=200, lr=0.3)
    weights_a = result_a.get("weights", {})
    weights_b = result_b.get("weights", {})
    assert set(weights_a.keys()) == set(weights_b.keys())
    for name in weights_a:
        np.testing.assert_allclose(weights_a[name], weights_b[name], rtol=1e-8, atol=1e-8)
