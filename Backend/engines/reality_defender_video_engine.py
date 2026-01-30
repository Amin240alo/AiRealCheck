from Backend.engines.reality_defender_engine import analyze_reality_defender


def analyze_reality_defender_video(asset_path: str) -> dict:
    result = analyze_reality_defender(asset_path)
    if isinstance(result, dict):
        result = dict(result)
        result["engine"] = "reality_defender_video"
    return result
