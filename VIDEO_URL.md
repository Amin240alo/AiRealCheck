# Video-Link Analyse

## Nutzung
- Frontend: In "Video pruefen" auf "Link" wechseln, URL eingeben, "Analysieren" klicken.
- Backend Endpoint:
  - Auth: `POST /analyze/video-url`
  - Guest: `POST /analyze/video-url/guest`

### Beispiel-Request
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

### Beispiel-Response (Erfolg)
```json
{
  "ok": true,
  "verdict": "uncertain",
  "real": 42,
  "fake": 58,
  "usage": {
    "source": "video_forensics",
    "credit_spent": false,
    "credits_left": null
  }
}
```

### Typische Fehler
- `url_not_allowed`: Domain nicht erlaubt
- `url_private_ip`: Private IPs/localhost blockiert
- `auth_required`: Link erfordert Login oder ist privat
- `ytdlp_missing`: yt-dlp fehlt und Link ist keine direkte Videodatei
- `file_too_large`: Datei groesser als Limit
- `download_timeout`: Download Timeout
- `unsupported_format`: Keine Videodatei/Format

## Limits und Sicherheit
- Nur http/https URLs
- Domain-Whitelist (Subdomains erlaubt)
- SSRF-Schutz inkl. DNS-Resolve und private IP Blockliste
- Redirects werden validiert
- Download-Limit (Groesse, Timeout)

## ENV Variablen
- `ALLOWED_VIDEO_DOMAINS`
- `AIREALCHECK_MAX_VIDEO_MB`
- `AIREALCHECK_MAX_VIDEO_SECONDS`
- `AIREALCHECK_URL_REQUEST_TIMEOUT`
- `AIREALCHECK_VIDEO_URL_MAX_LEN`
- `AIREALCHECK_TEMP_DIR`
