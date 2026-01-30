import os
import socket
import pytest

from Backend.video_url_fetcher import validate_video_url, VideoUrlError


def _mock_getaddrinfo(*_args, **_kwargs):
    return [
        (socket.AF_INET, None, None, None, ("93.184.216.34", 0)),
    ]


def _mock_getaddrinfo_private(*_args, **_kwargs):
    return [
        (socket.AF_INET, None, None, None, ("127.0.0.1", 0)),
    ]


def test_reject_non_http(monkeypatch):
    monkeypatch.setenv("ALLOWED_VIDEO_DOMAINS", "example.com")
    with pytest.raises(VideoUrlError) as exc:
        validate_video_url("ftp://example.com/video.mp4")
    assert exc.value.code == "url_invalid_scheme"


def test_block_private_ip_literal(monkeypatch):
    monkeypatch.setenv("ALLOWED_VIDEO_DOMAINS", "example.com")
    with pytest.raises(VideoUrlError) as exc:
        validate_video_url("http://127.0.0.1/video.mp4")
    assert exc.value.code == "url_private_ip"


def test_block_private_ip_resolved(monkeypatch):
    monkeypatch.setenv("ALLOWED_VIDEO_DOMAINS", "example.com")
    monkeypatch.setattr(socket, "getaddrinfo", _mock_getaddrinfo_private)
    with pytest.raises(VideoUrlError) as exc:
        validate_video_url("https://example.com/video.mp4")
    assert exc.value.code == "url_private_ip"


def test_allow_whitelisted_domain(monkeypatch):
    monkeypatch.setenv("ALLOWED_VIDEO_DOMAINS", "example.com")
    monkeypatch.setattr(socket, "getaddrinfo", _mock_getaddrinfo)
    normalized = validate_video_url("https://cdn.example.com/video.mp4")
    assert normalized.startswith("https://cdn.example.com/")


def test_reject_overlong_url(monkeypatch):
    monkeypatch.setenv("ALLOWED_VIDEO_DOMAINS", "example.com")
    monkeypatch.setenv("AIREALCHECK_VIDEO_URL_MAX_LEN", "50")
    with pytest.raises(VideoUrlError) as exc:
        validate_video_url("https://example.com/" + ("a" * 200))
    assert exc.value.code == "url_too_long"
