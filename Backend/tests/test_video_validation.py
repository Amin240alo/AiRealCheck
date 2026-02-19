import os

from Backend import video_validation as vv
from Backend import video_limits as vl


def test_validate_duration_too_long(monkeypatch, tmp_path):
    path = tmp_path / "sample.mp4"
    path.write_bytes(b"0")
    monkeypatch.setattr(vv, "get_max_video_seconds", lambda: 10.0)
    monkeypatch.setattr(vv, "get_video_duration_sec", lambda p: 20.0)
    monkeypatch.setattr(vv, "get_video_scan_fps", lambda: 2.0)
    monkeypatch.setattr(vv, "get_video_max_scan_frames", lambda: 10000)
    result = vv.validate_video_input(str(path))
    assert result["ok"] is False
    assert result["code"] == "video_too_long"
    assert result["http_status"] == 413


def test_max_seconds_default_when_unlimited_disabled(monkeypatch):
    monkeypatch.setenv("AIREALCHECK_MAX_VIDEO_SECONDS", "0")
    monkeypatch.setenv("AIREALCHECK_ALLOW_UNLIMITED_VIDEO_SECONDS", "false")
    assert vl.get_max_video_seconds() == vl.DEFAULT_MAX_VIDEO_SECONDS


def test_validate_too_many_frames(monkeypatch, tmp_path):
    path = tmp_path / "sample.mp4"
    path.write_bytes(b"0")
    monkeypatch.setattr(vv, "get_max_video_seconds", lambda: 1000.0)
    monkeypatch.setattr(vv, "get_video_duration_sec", lambda p: 100.0)
    monkeypatch.setattr(vv, "get_video_scan_fps", lambda: 5.0)
    monkeypatch.setattr(vv, "get_video_max_scan_frames", lambda: 200)
    result = vv.validate_video_input(str(path))
    assert result["ok"] is False
    assert result["code"] == "too_many_frames"
