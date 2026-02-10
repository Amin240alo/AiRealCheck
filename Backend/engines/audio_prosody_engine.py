import os
import shutil
import subprocess
import tempfile
import time
import wave

import numpy as np


ENGINE_NAME = "audio_prosody"


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

    tmpdir = tempfile.mkdtemp(prefix="audio_prosody_extract_")
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


def _frame_iter(samples, frame_size, hop, step):
    if len(samples) < frame_size:
        frame = np.zeros(frame_size, dtype=np.float32)
        if len(samples):
            frame[: len(samples)] = samples
        yield frame
        return
    for start in range(0, len(samples) - frame_size + 1, hop * step):
        yield samples[start : start + frame_size]


def _estimate_pitch_acf(frame, sample_rate, min_hz=60.0, max_hz=400.0, min_corr=0.3):
    if sample_rate <= 0:
        return None
    frame = frame.astype(np.float32, copy=False)
    frame = frame - float(np.mean(frame))
    if not np.any(frame):
        return None
    window = np.hanning(len(frame)).astype(np.float32)
    frame = frame * window
    acf = np.correlate(frame, frame, mode="full")[len(frame) - 1 :]
    if len(acf) == 0 or acf[0] <= 0:
        return None
    acf = acf / acf[0]
    min_lag = int(sample_rate / float(max_hz))
    max_lag = int(sample_rate / float(min_hz))
    if max_lag >= len(acf):
        max_lag = len(acf) - 1
    if max_lag <= min_lag or min_lag <= 0:
        return None
    segment = acf[min_lag : max_lag + 1]
    peak_idx = int(np.argmax(segment))
    peak_val = float(segment[peak_idx])
    if peak_val < min_corr:
        return None
    lag = min_lag + peak_idx
    if lag <= 0:
        return None
    return float(sample_rate) / float(lag)


def _append_signal(signals, name, value, signal_type):
    if value is None:
        return
    signals.append({"name": name, "value": value, "type": signal_type})


def _compute_prosody(samples, sample_rate):
    duration_s = float(len(samples)) / float(sample_rate) if sample_rate else 0.0
    frame_size = int(max(160, round(sample_rate * 0.04)))
    hop = int(max(80, round(sample_rate * 0.01)))
    total_frames = 1 if len(samples) < frame_size else 1 + (len(samples) - frame_size) // hop
    max_frames = int(os.getenv("AIREALCHECK_AUDIO_MAX_FRAMES", "2000"))
    step = max(1, int(total_frames / max_frames)) if total_frames > max_frames else 1

    rms_values = []
    for frame in _frame_iter(samples, frame_size, hop, step):
        rms_values.append(float(np.sqrt(np.mean(frame ** 2))))
    frame_count = len(rms_values)
    if frame_count == 0:
        return [], "low_voiced_or_pitch"

    rms_array = np.array(rms_values, dtype=np.float32)
    rms_mean = float(np.mean(rms_array))
    rms_std = float(np.std(rms_array))
    rms_cv = float(rms_std / rms_mean) if rms_mean > 1e-9 else 0.0

    threshold = float(np.percentile(rms_array, 60)) if frame_count else 0.0
    threshold = max(1e-5, threshold)
    voiced_mask = rms_array > threshold
    voiced_count = int(np.sum(voiced_mask))
    voiced_ratio = float(voiced_count) / float(frame_count) if frame_count else 0.0

    f0_values = []
    if voiced_count > 0:
        idx = 0
        for frame in _frame_iter(samples, frame_size, hop, step):
            if voiced_mask[idx]:
                f0 = _estimate_pitch_acf(frame, sample_rate)
                if f0 is not None and 50.0 <= f0 <= 500.0:
                    f0_values.append(float(f0))
            idx += 1

    f0_valid_frames = int(len(f0_values))
    min_voiced_frames = max(3, int(frame_count * 0.05))
    low_voiced = voiced_count < min_voiced_frames
    low_pitch = f0_valid_frames < 5
    warning = "low_voiced_or_pitch" if (low_voiced or low_pitch) else None

    signals = []
    _append_signal(signals, "duration_s", round(duration_s, 3), "meta")
    _append_signal(signals, "rms_mean", round(rms_mean, 6), "score")
    _append_signal(signals, "rms_std", round(rms_std, 6), "score")
    _append_signal(signals, "rms_cv", round(rms_cv, 4), "score")
    _append_signal(signals, "energy_std", round(rms_std, 6), "score")
    _append_signal(signals, "voiced_ratio", round(voiced_ratio, 4), "score")
    _append_signal(signals, "f0_valid_frames", f0_valid_frames, "meta")

    if not warning:
        f0_array = np.array(f0_values, dtype=np.float32)
        f0_median = float(np.median(f0_array))
        f0_std = float(np.std(f0_array))
        f0_mean = float(np.mean(f0_array))
        f0_cv = float(f0_std / f0_mean) if f0_mean > 1e-9 else 0.0
        _append_signal(signals, "f0_median_hz", round(f0_median, 2), "score")
        _append_signal(signals, "f0_std_hz", round(f0_std, 2), "score")
        _append_signal(signals, "f0_cv", round(f0_cv, 4), "score")
        if len(f0_values) >= 2:
            diffs = np.abs(np.diff(f0_array))
            jitter_approx = float(np.median(diffs))
            jitter_cv = float(np.std(diffs) / f0_mean) if f0_mean > 1e-9 else 0.0
            _append_signal(signals, "jitter_approx", round(jitter_approx, 3), "score")
            _append_signal(signals, "jitter_cv", round(jitter_cv, 4), "score")

    return signals, warning


def run_audio_prosody(file_path):
    start = time.time()
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

        samples = samples.astype(np.float32, copy=False)
        signals, warning = _compute_prosody(samples, sample_rate)
        return _result(
            status="ok",
            available=True,
            ai_likelihood=None,
            confidence=0.0,
            signals=signals,
            notes="prosody_signals_only",
            start_time=start,
            warning=warning,
        )
    except Exception as exc:
        return _result(
            status="error",
            available=False,
            ai_likelihood=None,
            confidence=0.0,
            signals=[],
            notes="error",
            start_time=start,
            warning=str(exc)[:240],
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
        print(run_audio_prosody(test_path))
    else:
        print("Set AIREALCHECK_AUDIO_SELFTEST=path_to_audio.wav")
