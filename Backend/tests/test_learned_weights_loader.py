from Backend import learned_weights


def test_loader_normalizes_example_dataset():
    samples = learned_weights.load_labeled_samples("data/labeled_samples.example.jsonl")
    assert samples
    img_sample = next(s for s in samples if s["id"] == "img-1")
    assert abs(img_sample["engine_ai"]["xception"] - 0.72) < 1e-9
    assert abs(img_sample["engine_ai"]["hive"] - 0.90) < 1e-9
