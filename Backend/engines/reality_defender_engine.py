import mimetypes
import os
import time

import requests


_BASE_URL = "https://api.prd.realitydefender.xyz"
_PRESIGNED_ENDPOINT = "/api/files/aws-presigned"
_RESULT_ENDPOINT = "/api/media/users/{request_id}"
_POLL_INTERVAL_SEC = 3.0
_MAX_POLL_SECONDS = 90.0


def _paid_apis_enabled():
    return os.getenv("AIREALCHECK_USE_PAID_APIS", "false").lower() in {"1", "true", "yes"}


def _not_available(notes="not_available"):
    return {
        "engine": "reality_defender",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": [],
        "notes": notes,
        "available": False,
    }


def _disabled():
    return {
        "engine": "reality_defender",
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": ["paid_apis_disabled"],
        "notes": "disabled:paid_apis_off",
        "available": False,
        "status": "disabled",
    }


def _http_note(status_code, response):
    note = f"http_{status_code}"
    if response is None:
        return note
    try:
        text = (response.text or "").strip()
    except Exception:
        text = ""
    if text:
        snippet = text.replace("\r", " ").replace("\n", " ")
        snippet = snippet[:200]
        note = f"{note}:{snippet}"
    return note


def _debug_enabled():
    return (os.getenv("AIREALCHECK_DEBUG_RAW", "false").lower() in {"1", "true", "yes"})


def _extract_presigned(payload):
    if not isinstance(payload, dict):
        return None, None, None

    candidates = [payload]
    data = payload.get("data")
    if isinstance(data, dict):
        candidates.append(data)
    payload_block = payload.get("payload")
    if isinstance(payload_block, dict):
        candidates.append(payload_block)
    response_block = payload.get("response")
    if isinstance(response_block, dict):
        candidates.append(response_block)

    for candidate in candidates:
        url = (
            candidate.get("url")
            or candidate.get("uploadUrl")
            or candidate.get("upload_url")
            or candidate.get("signedUrl")
            or candidate.get("signed_url")
            or candidate.get("presignedUrl")
            or candidate.get("presigned_url")
        )
        request_id = candidate.get("requestId") or candidate.get("request_id") or candidate.get("id")
        fields = (
            candidate.get("fields")
            or candidate.get("uploadFields")
            or candidate.get("upload_fields")
        )
        if isinstance(url, str):
            url = url.strip()
        if isinstance(request_id, str):
            request_id = request_id.strip()
        if isinstance(fields, dict) and not fields:
            fields = None

        if url and fields:
            return url, fields, request_id
        if url and not fields:
            return url, None, request_id
    return None, None, None


def _extract_result(payload):
    if not isinstance(payload, dict):
        return None, None, []
    summary = payload.get("resultsSummary") if isinstance(payload.get("resultsSummary"), dict) else {}
    status = summary.get("status") or payload.get("status")
    metadata = summary.get("metadata") if isinstance(summary.get("metadata"), dict) else {}
    reasons = metadata.get("reasons") if isinstance(metadata.get("reasons"), list) else []

    score_candidates = [
        metadata.get("finalScore"),
        summary.get("finalScore") if isinstance(summary, dict) else None,
        payload.get("finalScore"),
    ]
    final_score = None
    for candidate in score_candidates:
        if candidate is not None:
            final_score = candidate
            break
    return status, final_score, reasons


def _normalize_status(status):
    if not isinstance(status, str):
        return ""
    return status.strip().lower().replace("-", "_")


def _is_processing_status(status):
    normalized = _normalize_status(status)
    return normalized in {"processing", "pending", "queued", "in_progress", "running"}


def analyze_reality_defender(asset_path: str) -> dict:
    if not _paid_apis_enabled():
        return _disabled()
    api_key = (os.getenv("REALITY_DEFENDER_API_KEY") or "").strip()
    if not api_key:
        return _not_available()

    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    file_name = os.path.basename(asset_path)
    file_size = None
    try:
        file_size = os.path.getsize(asset_path)
    except Exception:
        file_size = None
    mime_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"

    try:
        payload = {
            "fileName": file_name,
            "filename": file_name,
            "contentType": mime_type,
            "mimeType": mime_type,
        }
        if isinstance(file_size, int):
            payload["size"] = file_size
            payload["fileSize"] = file_size
        resp = requests.post(
            f"{_BASE_URL}{_PRESIGNED_ENDPOINT}",
            headers=headers,
            json=payload,
            timeout=(5, 10),
        )
    except Exception:
        return _not_available("request_failed")

    if resp.status_code < 200 or resp.status_code >= 300:
        return _not_available(_http_note(resp.status_code, resp))

    try:
        presigned_payload = resp.json()
    except Exception:
        return _not_available("invalid_json")

    if _debug_enabled() and isinstance(presigned_payload, dict):
        top_keys = list(presigned_payload.keys())
        data_keys = []
        if isinstance(presigned_payload.get("data"), dict):
            data_keys = list(presigned_payload.get("data").keys())
        payload_keys = []
        if isinstance(presigned_payload.get("payload"), dict):
            payload_keys = list(presigned_payload.get("payload").keys())
        response_val = presigned_payload.get("response")
        response_type = type(response_val).__name__
        response_keys = []
        if isinstance(response_val, dict):
            response_keys = list(response_val.keys())
        debug_line = (
            f"[reality_defender] presigned keys={top_keys} data_keys={data_keys} "
            f"payload_keys={payload_keys} code={presigned_payload.get('code')} "
            f"errno={presigned_payload.get('errno')} response_type={response_type} "
            f"response_keys={response_keys}"
        )
        print(debug_line)

    if isinstance(presigned_payload, dict) and (
        presigned_payload.get("code") is not None or presigned_payload.get("errno") is not None
    ):
        code = presigned_payload.get("code")
        errno = presigned_payload.get("errno")
        code_norm = str(code).strip().lower() if code is not None else ""
        errno_norm = str(errno).strip().lower() if errno is not None else ""
        ok_codes = {"0", "ok", "success", "true", "none", ""}
        if (code_norm and code_norm not in ok_codes) or (errno_norm and errno_norm not in {"0", "none", ""}):
            msg = ""
            response_val = presigned_payload.get("response")
            if isinstance(response_val, dict):
                for key in ("message", "error", "detail", "description"):
                    if isinstance(response_val.get(key), str) and response_val.get(key).strip():
                        msg = response_val.get(key).strip()
                        break
            msg = msg.replace("\r", " ").replace("\n", " ")[:200]
            note = f"rd_presigned_error:{code}:{errno}"
            if msg:
                note = f"{note}:{msg}"
            return _not_available(note)

    if isinstance(presigned_payload, dict) and isinstance(presigned_payload.get("response"), dict):
        upload_url, upload_fields, request_id = _extract_presigned(presigned_payload.get("response"))
    else:
        upload_url, upload_fields, request_id = _extract_presigned(presigned_payload)
    if not upload_url:
        keys_note = ""
        if isinstance(presigned_payload, dict):
            top_keys = [str(k) for k in presigned_payload.keys()]
            response_keys = []
            if isinstance(presigned_payload.get("response"), dict):
                response_keys = [str(k) for k in presigned_payload.get("response").keys()]
            keys_note = "top=" + ",".join(top_keys)
            if response_keys:
                keys_note += " response=" + ",".join(response_keys)
            keys_note = keys_note[:200]
        note = "bad_presigned_response"
        if keys_note:
            note = f"{note}:{keys_note}"
        return _not_available(note)

    upload_resp = None
    if upload_fields:
        try:
            with open(asset_path, "rb") as f:
                files = {"file": (os.path.basename(asset_path), f)}
                upload_resp = requests.post(
                    upload_url,
                    data=upload_fields,
                    files=files,
                    timeout=(5, 20),
                )
        except Exception:
            return _not_available("upload_failed")
    else:
        try:
            with open(asset_path, "rb") as f:
                upload_resp = requests.put(
                    upload_url,
                    data=f,
                    headers={"Content-Type": mime_type},
                    timeout=(5, 20),
                )
        except Exception:
            return _not_available("upload_failed")

    if upload_resp is None:
        return _not_available("upload_failed")

    if upload_resp.status_code < 200 or upload_resp.status_code >= 300:
        return _not_available(_http_note(upload_resp.status_code, upload_resp))

    if not request_id:
        request_id = (
            (presigned_payload.get("requestId") if isinstance(presigned_payload, dict) else None)
            or (presigned_payload.get("id") if isinstance(presigned_payload, dict) else None)
        )
        if isinstance(request_id, str):
            request_id = request_id.strip()
    if not request_id:
        return _not_available("missing_request_id")

    deadline = time.time() + _MAX_POLL_SECONDS
    status = None
    final_score = None
    reasons = []

    while time.time() < deadline:
        try:
            result_resp = requests.get(
                f"{_BASE_URL}{_RESULT_ENDPOINT.format(request_id=request_id)}",
                headers={"X-API-KEY": api_key},
                timeout=(5, 10),
            )
        except Exception:
            return _not_available("poll_failed")

        if result_resp.status_code < 200 or result_resp.status_code >= 300:
            return _not_available(_http_note(result_resp.status_code, result_resp))

        try:
            payload = result_resp.json()
        except Exception:
            return _not_available("invalid_json")

        status, final_score, reasons = _extract_result(payload)
        normalized_status = _normalize_status(status)
        if final_score is not None:
            break
        if normalized_status in {"not_applicable", "unable_to_evaluate", "failed", "error"}:
            break
        if _is_processing_status(status):
            time.sleep(_POLL_INTERVAL_SEC)
            continue
        time.sleep(_POLL_INTERVAL_SEC)

    signals = []
    if status:
        signals.append(f"status:{status}")

    for item in reasons:
        if not isinstance(item, dict):
            continue
        code = (item.get("code") or "").strip()
        message = (item.get("message") or "").strip()
        if code and message:
            signals.append(f"reason:{code}:{message}")
        elif code:
            signals.append(f"reason:{code}")
        elif message:
            signals.append(f"reason:{message}")

    ai_likelihood = None
    if final_score is not None:
        try:
            score = float(final_score)
            if score < 0.0:
                score = 0.0
            if score > 100.0:
                score = 100.0
            ai_likelihood = score / 100.0
        except Exception:
            ai_likelihood = None

    normalized_status = _normalize_status(status)
    if _is_processing_status(status):
        signals = ["processing"]
        if status:
            signals.append(f"status:{status}")
        return {
            "engine": "reality_defender",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": signals[:6],
            "notes": "Reality Defender verarbeitet noch",
            "available": True,
        }

    if ai_likelihood is None and normalized_status in {"not_applicable", "unable_to_evaluate"}:
        return {
            "engine": "reality_defender",
            "ai_likelihood": None,
            "confidence": 0.0,
            "signals": signals[:6],
            "notes": normalized_status or "not_available",
            "available": True,
        }

    if ai_likelihood is None:
        return _not_available(normalized_status or "not_available")

    confidence = max(ai_likelihood, 1.0 - ai_likelihood)
    notes = "ok"
    if isinstance(status, str) and status:
        notes = status.lower()

    return {
        "engine": "reality_defender",
        "ai_likelihood": ai_likelihood,
        "confidence": confidence,
        "signals": signals[:6],
        "notes": notes,
        "available": True,
    }
