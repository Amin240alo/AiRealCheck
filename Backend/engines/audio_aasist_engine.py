import os
import shutil
import subprocess
import tempfile
import time
import wave

import numpy as np

try:
    from Backend.vendor.aasist import (
        load_aasist_model,
        predict_spoof_prob,
        resolve_weights_path,
    )
    _VENDOR_IMPORT_ERROR = None
except Exception as exc:
    load_aasist_model = None
    predict_spoof_prob = None
    resolve_weights_path = None
    _VENDOR_IMPORT_ERROR = str(exc)[:240]


ENGINE_NAME = "audio_aasist"
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_FALLBACK_WEIGHTS_PATH = os.path.abspath(
    os.path.join(_BACKEND_DIR, "vendor", "aasist", "models", "weights", "AASIST.pth")
)
_MODEL_CACHE = {"attempted": False, "model": None, "meta": None}


def _weights_path():
    if callable(resolve_weights_path):
        try:
            resolved = resolve_weights_path()
            return os.path.abspath(resolved)
        except Exception:
            pass
    return _FALLBACK_WEIGHTS_PATH


def _clamp01(value):
    try:
        v = float(value)
    except Exception:
        return 0.0
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


def _result(
    *,
    status,
    available,
    ai_likelihood,
    confidence,
    signals,
    notes,
    start_time,
    warning=None,
):
    payload = {
        "engine": ENGINE_NAME,
        "status": status,
        "available": bool(available),
        "ai_likelihood": ai_likelihood,
        "confidence": float(confidence),
        "signals": signals if isinstance(signals, list) else [],
        "notes": str(notes),
        "timing_ms": int((time.time() - start_time) * 1000),
    }
    if warning:
        payload["warning"] = str(warning)
    return payload


def _candidate_windows_ffmpeg_paths(exe_name: str):
    localapp = os.getenv("LOCALAPPDATA") or ""
    programdata = os.getenv("PROGRAMDATA") or ""
    candidates = [
        os.path.join(localapp, "Microsoft", "WinGet", "Links", exe_name),
        os.path.join(programdata, "chocolatey", "bin", exe_name),
        os.path.join("C:\\", "ffmpeg", "bin", exe_name),
        os.path.join("C:\\", "Program Files", "ffmpeg", "bin", exe_name),
        os.path.join("C:\\", "Program Files (x86)", "ffmpeg", "bin", exe_name),
    ]
    return [p for p in candidates if p and os.path.exists(p)]


def _powershell_get_command(exe_name: str):
    try:
        proc = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                f"(Get-Command {exe_name} -ErrorAction SilentlyContinue).Source",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=2,
            check=False,
        )
    except Exception:
        return ""
    if proc.returncode != 0:
        return ""
    output = (proc.stdout.decode("utf-8", errors="ignore") or "").strip()
    return output if output and os.path.exists(output) else ""


def _resolve_ffmpeg_path(exe_name: str):
    env_path = (os.getenv("FFMPEG_PATH") or "").strip()
    if env_path:
        if os.path.isdir(env_path):
            candidate = os.path.join(env_path, exe_name)
            if os.path.exists(candidate):
                return candidate
        if os.path.exists(env_path):
            return env_path
    which_path = shutil.which(exe_name.replace(".exe", "")) or shutil.which(exe_name)
    if which_path:
        return which_path
    ps_path = _powershell_get_command(exe_name)
    if ps_path:
        return ps_path
    candidates = _candidate_windows_ffmpeg_paths(exe_name)
    return candidates[0] if candidates else ""


def _ffmpeg_path():
    return _resolve_ffmpeg_path("ffmpeg.exe")


def _extract_audio_ffmpeg(file_path, sample_rate=16000, timeout_sec=25):
    ffmpeg = _ffmpeg_path()
    if not ffmpeg or not os.path.exists(ffmpeg):
        return "", {"note": "ffmpeg_not_installed", "stderr": ""}
    if not os.access(ffmpeg, os.X_OK):
        return "", {"note": "ffmpeg_not_executable", "stderr": ""}
    if not os.path.exists(file_path):
        return "", {"note": "file_missing", "stderr": ""}
    try:
        if os.path.getsize(file_path) <= 0:
            return "", {"note": "file_size_0", "stderr": ""}
    except Exception:
        return "", {"note": "file_size_0", "stderr": ""}

    tmpdir = tempfile.mkdtemp(prefix="audio_aasist_extract_")
    out_path = os.path.join(tmpdir, "audio.wav")
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        file_path,
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-acodec",
        "pcm_s16le",
        out_path,
    ]
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_sec,
            check=False,
        )
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return "", {"note": "timeout", "stderr": ""}
    except Exception:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return "", {"note": "ffmpeg_error", "stderr": ""}

    stderr = (proc.stderr.decode("utf-8", errors="ignore") or "").strip()
    if proc.returncode != 0 or not os.path.exists(out_path):
        note = "ffmpeg_extract_failed"
        if stderr:
            note = f"ffmpeg_extract_failed:{stderr[:160]}"
        shutil.rmtree(tmpdir, ignore_errors=True)
        return "", {"note": note, "stderr": stderr}

    try:
        if os.path.getsize(out_path) <= 0:
            shutil.rmtree(tmpdir, ignore_errors=True)
            return "", {"note": "ffmpeg_no_audio", "stderr": stderr}
    except Exception:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return "", {"note": "ffmpeg_no_audio", "stderr": stderr}

    return out_path, {"note": "ok", "stderr": stderr, "tmpdir": tmpdir}


def _read_wav(path):
    with wave.open(path, "rb") as wf:
        channels = wf.getnchannels()
        sample_rate = wf.getframerate()
        sample_width = wf.getsampwidth()
        frames = wf.getnframes()
        data = wf.readframes(frames)

    if frames <= 0:
        return None, sample_rate, 0

    if sample_width == 1:
        audio = np.frombuffer(data, dtype=np.uint8).astype(np.float32)
        audio = (audio - 128.0) / 128.0
    elif sample_width == 2:
        audio = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
    elif sample_width == 4:
        audio = np.frombuffer(data, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError("unsupported_sample_width")

    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    return audio, sample_rate, frames


def _build_signals(prob_spoof=None, duration_s=None, sample_rate_hz=16000, model_format=None):
    signals = [{"name": "model", "value": "AASIST", "type": "meta"}]
    if model_format:
        signals.append({"name": "model_format", "value": str(model_format), "type": "meta"})
    if prob_spoof is not None:
        signals.append({"name": "prob_spoof", "value": round(float(prob_spoof), 4), "type": "score"})
    if duration_s is not None:
        signals.append({"name": "duration_s", "value": round(float(duration_s), 3), "type": "meta"})
    signals.append({"name": "sample_rate_hz", "value": int(sample_rate_hz), "type": "meta"})
    return signals


def _state_dict_warning(meta, prefix=""):
    if not isinstance(meta, dict):
        return ""
    parts = []
    missing = meta.get("missing_keys")
    unexpected = meta.get("unexpected_keys")
    loaded = meta.get("loaded_keys")
    total = meta.get("state_dict_keys")
    if isinstance(loaded, int) and isinstance(total, int):
        parts.append(f"loaded_keys={loaded}/{total}")
    if isinstance(missing, list) and missing:
        parts.append("missing_keys=" + ",".join([str(k) for k in missing[:5]]))
    if isinstance(unexpected, list) and unexpected:
        parts.append("unexpected_keys=" + ",".join([str(k) for k in unexpected[:5]]))
    if not parts:
        return ""
    summary = ";".join(parts)
    if prefix:
        return f"{prefix};{summary}"[:240]
    return summary[:240]


def _combine_warnings(*parts):
    cleaned = [str(p).strip() for p in parts if p is not None and str(p).strip()]
    if not cleaned:
        return ""
    return ";".join(cleaned)[:240]


def _load_model_cached():
    if _MODEL_CACHE["attempted"]:
        return _MODEL_CACHE["model"], _MODEL_CACHE["meta"] or {}

    _MODEL_CACHE["attempted"] = True
    if load_aasist_model is None:
        meta = {"format": "unavailable", "reason": "vendor_import_failed"}
        if _VENDOR_IMPORT_ERROR:
            meta["error"] = _VENDOR_IMPORT_ERROR
        _MODEL_CACHE["meta"] = meta
        return None, meta

    try:
        model, meta = load_aasist_model(device="cpu")
    except Exception as exc:
        meta = {"format": "unknown", "reason": "model_loader_exception", "error": str(exc)[:240]}
        _MODEL_CACHE["meta"] = meta
        return None, meta

    _MODEL_CACHE["model"] = model
    _MODEL_CACHE["meta"] = meta if isinstance(meta, dict) else {"format": "unknown"}
    return _MODEL_CACHE["model"], _MODEL_CACHE["meta"]


def run_audio_aasist(file_path):
    start = time.time()
    weights_path = _weights_path()

    if not file_path or not os.path.exists(file_path):
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes="file_missing",
            start_time=start,
        )

    if not os.path.exists(weights_path):
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes=f"weights_missing:{weights_path}",
            start_time=start,
            warning=f"resolved_weights_path={weights_path}",
        )

    tmp_dir = ""
    try:
        samples = None
        sample_rate = None

        if file_path.lower().endswith(".wav"):
            try:
                wav_samples, wav_sr, _ = _read_wav(file_path)
                if wav_samples is not None and wav_sr == 16000:
                    samples = wav_samples
                    sample_rate = wav_sr
            except Exception:
                samples = None

        if samples is None:
            wav_path, meta = _extract_audio_ffmpeg(file_path, sample_rate=16000)
            if not wav_path:
                return _result(
                    status="error",
                    available=False,
                    ai_likelihood=None,
                    confidence=0.0,
                    signals=[],
                    notes=meta.get("note", "ffmpeg_extract_failed"),
                    start_time=start,
                )
            tmp_dir = meta.get("tmpdir") or ""
            try:
                samples, sample_rate, _ = _read_wav(wav_path)
            except Exception:
                return _result(
                    status="error",
                    available=False,
                    ai_likelihood=None,
                    confidence=0.0,
                    signals=[],
                    notes="audio_decode_failed",
                    start_time=start,
                )

        if samples is None or sample_rate is None or len(samples) == 0:
            return _result(
                status="error",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=[],
                notes="audio_decode_failed",
                start_time=start,
            )

        duration_s = float(len(samples)) / float(sample_rate) if sample_rate else 0.0
        warning = "short_audio" if duration_s < 2.0 else None

        model, model_meta = _load_model_cached()
        model_meta = model_meta if isinstance(model_meta, dict) else {}
        model_format = model_meta.get("format")

        if model is None:
            reason = str(model_meta.get("reason") or "")
            if reason == "weights_missing":
                notes = f"weights_missing:{weights_path}"
            elif reason in {"upstream_import_failed", "upstream_not_found", "model_constructor_missing", "vendor_import_failed"}:
                notes = "upstream_import_failed"
            elif reason in {"checkpoint_load_failed", "state_dict_load_failed", "state_dict_mismatch_no_compatible_keys"}:
                notes = "checkpoint_load_failed"
            else:
                notes = "checkpoint_load_failed"

            signals = _build_signals(
                prob_spoof=None,
                duration_s=duration_s,
                sample_rate_hz=16000,
                model_format=model_format,
            )
            reason_text = reason if reason else "model_not_loadable"
            warning_parts = [reason_text]
            if model_meta.get("error"):
                warning_parts.append(str(model_meta.get("error")))
            details = model_meta.get("details")
            if isinstance(details, dict):
                detail_reason = details.get("reason")
                detail_errors = details.get("errors")
                if detail_reason:
                    warning_parts.append(f"detail_reason={detail_reason}")
                if isinstance(detail_errors, list) and detail_errors:
                    warning_parts.append("detail_errors=" + "|".join([str(e) for e in detail_errors[:2]]))
            model_warning = _combine_warnings(*warning_parts)
            sd_warn = _state_dict_warning(model_meta, prefix=model_warning)
            if sd_warn:
                model_warning = sd_warn
            if warning:
                model_warning = _combine_warnings(warning, model_warning)
            return _result(
                status="error",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=signals,
                notes=notes,
                start_time=start,
                warning=model_warning if model_warning else f"resolved_weights_path={weights_path}",
            )

        if not callable(predict_spoof_prob):
            return _result(
                status="error",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=_build_signals(
                    prob_spoof=None,
                    duration_s=duration_s,
                    sample_rate_hz=16000,
                    model_format=model_format,
                ),
                notes="upstream_import_failed",
                start_time=start,
            )

        try:
            prob = _clamp01(predict_spoof_prob(model, samples.astype(np.float32)))
        except Exception as exc:
            infer_warning = str(exc)[:240]
            if warning:
                infer_warning = f"{warning};{infer_warning}"
            return _result(
                status="error",
                available=False,
                ai_likelihood=None,
                confidence=0.0,
                signals=_build_signals(
                    prob_spoof=None,
                    duration_s=duration_s,
                    sample_rate_hz=16000,
                    model_format=model_format,
                ),
                notes="inference_failed",
                start_time=start,
                warning=infer_warning,
            )

        confidence = min(0.95, 0.55 + abs(prob - 0.5))
        if duration_s < 2.0:
            confidence = min(confidence, 0.45)

        success_warning = _state_dict_warning(model_meta)
        if warning:
            success_warning = _combine_warnings(warning, success_warning)

        return _result(
            status="ok",
            available=True,
            ai_likelihood=prob,
            confidence=_clamp01(confidence),
            signals=_build_signals(
                prob_spoof=prob,
                duration_s=duration_s,
                sample_rate_hz=16000,
                model_format=model_format,
            ),
            notes="aasist_upstream_ok",
            start_time=start,
            warning=success_warning if success_warning else None,
        )
    finally:
        if tmp_dir:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass


if __name__ == "__main__":
    test_path = (os.getenv("AIREALCHECK_AUDIO_SELFTEST") or "").strip()
    if test_path and os.path.exists(test_path):
        print(run_audio_aasist(test_path))
    else:
        print("Set AIREALCHECK_AUDIO_SELFTEST=path_to_audio.wav")
