import os
import socket
import ipaddress
import urllib.parse
import uuid
import shutil
import subprocess
from typing import List, Tuple

import requests


ALLOWED_VIDEO_EXTS = {
    ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi", ".mpg", ".mpeg", ".3gp", ".ogv"
}

DEFAULT_ALLOWED_DOMAINS = {
    "tiktok.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "cdninstagram.com",
}

_BLOCKED_NETS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

_METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),
}


class VideoUrlError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _get_allowed_domains() -> List[str]:
    raw = os.getenv("ALLOWED_VIDEO_DOMAINS", "").strip()
    if raw:
        parts = [p.strip().lower() for p in raw.split(",") if p.strip()]
        return parts
    return sorted(DEFAULT_ALLOWED_DOMAINS)


def _max_url_len() -> int:
    return int(os.getenv("AIREALCHECK_VIDEO_URL_MAX_LEN", "2048"))


def _request_timeout() -> float:
    return float(os.getenv("AIREALCHECK_URL_REQUEST_TIMEOUT", "30"))


def _max_video_bytes() -> int:
    return int(os.getenv("AIREALCHECK_MAX_VIDEO_MB", "200")) * 1024 * 1024


def _max_video_seconds() -> float:
    try:
        return float(os.getenv("AIREALCHECK_MAX_VIDEO_SECONDS", "0"))
    except Exception:
        return 0.0


def _temp_dir() -> str:
    return os.getenv("AIREALCHECK_TEMP_DIR", "temp_upload")


def _is_ip_blocked(ip: ipaddress._BaseAddress) -> bool:
    if ip in _METADATA_IPS:
        return True
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
        return True
    for net in _BLOCKED_NETS:
        if ip in net:
            return True
    return False


def _resolve_host_ips(host: str) -> List[ipaddress._BaseAddress]:
    ips: List[ipaddress._BaseAddress] = []
    try:
        results = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return []
    for family, _, _, _, sockaddr in results:
        if family == socket.AF_INET:
            ip = ipaddress.ip_address(sockaddr[0])
            ips.append(ip)
        elif family == socket.AF_INET6:
            ip = ipaddress.ip_address(sockaddr[0])
            ips.append(ip)
    return ips


def _host_allowed(host: str, allowed_domains: List[str]) -> bool:
    host = (host or "").lower().rstrip(".")
    if not host:
        return False
    for domain in allowed_domains:
        domain = domain.lower().lstrip(".")
        if host == domain or host.endswith("." + domain):
            return True
    return False


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise VideoUrlError("url_missing", "URL fehlt", 400)
    if len(url) > _max_url_len():
        raise VideoUrlError("url_too_long", "URL zu lang", 400)
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in {"http", "https"}:
        raise VideoUrlError("url_invalid_scheme", "Nur http/https erlaubt", 400)
    if not parts.netloc:
        raise VideoUrlError("url_invalid", "URL ist ungueltig", 400)
    if parts.username or parts.password:
        raise VideoUrlError("url_invalid", "URL darf keine Zugangsdaten enthalten", 400)
    host = (parts.hostname or "").lower().rstrip(".")
    if host in {"localhost"} or host.endswith(".localhost"):
        raise VideoUrlError("url_private_ip", "URL zeigt auf localhost", 400)

    try:
        ip = ipaddress.ip_address(host)
        if _is_ip_blocked(ip):
            raise VideoUrlError("url_private_ip", "Private IPs sind blockiert", 400)
    except ValueError:
        pass

    allowed_domains = _get_allowed_domains()
    if allowed_domains and not _host_allowed(host, allowed_domains):
        raise VideoUrlError("url_not_allowed", "Domain nicht erlaubt", 400)

    if not _is_ip_literal(host):
        ips = _resolve_host_ips(host)
        if not ips:
            raise VideoUrlError("url_dns_failed", "DNS-Aufloesung fehlgeschlagen", 400)
        for ip in ips:
            if _is_ip_blocked(ip):
                raise VideoUrlError("url_private_ip", "Private IPs sind blockiert", 400)

    return _rebuild_url(parts)


def _is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def _rebuild_url(parts: urllib.parse.SplitResult) -> str:
    host = (parts.hostname or "").lower().rstrip(".")
    netloc = host
    if parts.port:
        if ":" in host:
            netloc = f"[{host}]:{parts.port}"
        else:
            netloc = f"{host}:{parts.port}"
    return urllib.parse.urlunsplit((parts.scheme, netloc, parts.path or "", parts.query or "", parts.fragment or ""))


def validate_video_url(url: str) -> str:
    return _normalize_url(url)


def fetch_video_from_url(url: str) -> Tuple[str, dict]:
    normalized = _normalize_url(url)
    temp_dir = _temp_dir()
    os.makedirs(temp_dir, exist_ok=True)

    if _yt_dlp_available():
        path = _download_with_ytdlp(normalized, temp_dir)
        _enforce_video_limits(path)
        return path, {"method": "yt-dlp"}

    if not _looks_like_direct_file(normalized):
        raise VideoUrlError("ytdlp_missing", "Link-Download nicht verfuegbar: yt-dlp fehlt", 400)

    path = _download_direct(normalized, temp_dir)
    _enforce_video_limits(path)
    return path, {"method": "direct"}


def _yt_dlp_available() -> bool:
    return shutil.which("yt-dlp") is not None


def _looks_like_direct_file(url: str) -> bool:
    path = urllib.parse.urlsplit(url).path or ""
    _, ext = os.path.splitext(path.lower())
    return ext in ALLOWED_VIDEO_EXTS


def _download_with_ytdlp(url: str, temp_dir: str) -> str:
    max_bytes = _max_video_bytes()
    max_mb = max_bytes // (1024 * 1024)
    timeout = _request_timeout()
    prefix = os.path.join(temp_dir, f"video_url_{uuid.uuid4()}")
    out_tpl = prefix + ".%(ext)s"
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-part",
        "--max-filesize",
        f"{max_mb}M",
        "-o",
        out_tpl,
        url,
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise VideoUrlError("download_timeout", "Download hat zu lange gedauert", 408)
    if proc.returncode != 0:
        stderr = (proc.stderr or "").lower()
        if "private" in stderr or "sign in" in stderr or "login" in stderr or "members only" in stderr:
            raise VideoUrlError("auth_required", "URL erfordert Login oder ist nicht oeffentlich", 403)
        if "unsupported url" in stderr or "no video formats found" in stderr:
            raise VideoUrlError("unsupported_format", "Unterstuetztes Format nicht gefunden", 415)
        raise VideoUrlError("download_failed", "Download fehlgeschlagen", 502)

    candidates = [p for p in glob_paths(prefix)]
    if not candidates:
        raise VideoUrlError("download_failed", "Download fehlgeschlagen", 502)
    path = max(candidates, key=lambda p: os.path.getsize(p))
    return path


def glob_paths(prefix: str) -> List[str]:
    folder = os.path.dirname(prefix)
    base = os.path.basename(prefix)
    files = []
    try:
        for name in os.listdir(folder):
            if name.startswith(base):
                files.append(os.path.join(folder, name))
    except Exception:
        pass
    return files


def _download_direct(url: str, temp_dir: str) -> str:
    max_bytes = _max_video_bytes()
    timeout = _request_timeout()
    max_redirects = 5
    session = requests.Session()
    headers = {"User-Agent": "AIRealCheck/1.0"}

    current = url
    for _ in range(max_redirects + 1):
        normalized = _normalize_url(current)
        if not _looks_like_direct_file(normalized):
            raise VideoUrlError("unsupported_format", "URL zeigt nicht auf eine Videodatei", 415)

        try:
            resp = session.get(
                normalized,
                headers=headers,
                stream=True,
                allow_redirects=False,
                timeout=timeout,
            )
        except requests.Timeout:
            raise VideoUrlError("download_timeout", "Download hat zu lange gedauert", 408)
        except requests.RequestException:
            raise VideoUrlError("download_failed", "Download fehlgeschlagen", 502)

        if resp.status_code in {301, 302, 303, 307, 308}:
            loc = resp.headers.get("Location")
            if not loc:
                raise VideoUrlError("download_failed", "Redirect ohne Ziel", 502)
            current = urllib.parse.urljoin(normalized, loc)
            continue

        if resp.status_code in {401, 403}:
            raise VideoUrlError("auth_required", "URL erfordert Login oder ist nicht oeffentlich", 403)
        if resp.status_code < 200 or resp.status_code >= 300:
            raise VideoUrlError("download_failed", "Download fehlgeschlagen", 502)

        content_type = (resp.headers.get("Content-Type") or "").lower()
        if not content_type.startswith("video/"):
            raise VideoUrlError("unsupported_format", "Kein Video-Content-Type", 415)

        content_length = resp.headers.get("Content-Length")
        if content_length:
            try:
                if int(content_length) > max_bytes:
                    raise VideoUrlError("file_too_large", "Datei zu gross", 413)
            except ValueError:
                pass

        filename = os.path.basename(urllib.parse.urlsplit(normalized).path) or f"video_{uuid.uuid4()}.mp4"
        dst_path = os.path.join(temp_dir, f"video_url_{uuid.uuid4()}_{filename}")
        size = 0
        try:
            with open(dst_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=1024 * 512):
                    if not chunk:
                        continue
                    size += len(chunk)
                    if size > max_bytes:
                        raise VideoUrlError("file_too_large", "Datei zu gross", 413)
                    f.write(chunk)
        finally:
            resp.close()
        return dst_path

    raise VideoUrlError("download_failed", "Zu viele Redirects", 502)


def _enforce_video_limits(path: str) -> None:
    max_bytes = _max_video_bytes()
    if os.path.exists(path):
        size = os.path.getsize(path)
        if size > max_bytes:
            raise VideoUrlError("file_too_large", "Datei zu gross", 413)

    max_seconds = _max_video_seconds()
    if max_seconds <= 0:
        return
    try:
        import cv2
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            cap.release()
            return
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0
        cap.release()
        if fps > 0 and frames > 0:
            duration = frames / fps
            if duration > max_seconds:
                raise VideoUrlError("video_too_long", "Video zu lang", 413)
    except VideoUrlError:
        raise
    except Exception:
        return
