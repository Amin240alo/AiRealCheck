import os
import shutil
import subprocess
import tempfile
import time
import wave

import numpy as np

ENGINE_NAME = "audio_forensics"


def _error(notes="error"):
    return {
        "engine": ENGINE_NAME,
        "ai_likelihood": None,
        "confidence": 0.0,
        "signals": [],
        "notes": notes,
        "status": "error",
        "available": False,
    }


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


def _log_debug(message: str):
    try:
        print(f"[audio_forensics] {message}")
    except Exception:
        pass


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


def _format_cmd(cmd):
    try:
        return " ".join([f'"{c}"' if " " in str(c) else str(c) for c in cmd])
    except Exception:
        return "<unprintable>"


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

    tmpdir = tempfile.mkdtemp(prefix="audio_extract_")
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
    _log_debug(f"ffmpeg_cmd={_format_cmd(cmd)}")
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


def _compute_metrics(samples, sample_rate):
    duration = float(len(samples)) / float(sample_rate) if sample_rate else 0.0
    rms = float(np.sqrt(np.mean(samples ** 2))) if len(samples) else 0.0

    if len(samples) > 1:
        zcr = float(np.mean(np.signbit(samples[:-1]) != np.signbit(samples[1:])))
    else:
        zcr = 0.0

    clip_threshold = 0.98
    clipping_ratio = float(np.mean(np.abs(samples) >= clip_threshold)) if len(samples) else 0.0

    frame_size = int(max(256, min(4096, round(sample_rate * 0.032)))) if sample_rate else 512
    hop = max(1, frame_size // 2)
    total_frames = 1 if len(samples) < frame_size else 1 + (len(samples) - frame_size) // hop
    max_frames = int(os.getenv("AIREALCHECK_AUDIO_MAX_FRAMES", "2000"))
    step = max(1, int(total_frames / max_frames)) if total_frames > max_frames else 1

    silence_threshold = max(1e-4, rms * 0.1)
    silent_frames = 0
    centroids = []
    frame_count = 0
    window = np.hanning(frame_size).astype(np.float32)
    freqs = np.fft.rfftfreq(frame_size, d=1.0 / float(sample_rate))

    if len(samples) < frame_size:
        frame = np.zeros(frame_size, dtype=np.float32)
        if len(samples):
            frame[: len(samples)] = samples
        frame_rms = float(np.sqrt(np.mean(frame ** 2)))
        if frame_rms < silence_threshold:
            silent_frames += 1
        mag = np.abs(np.fft.rfft(frame * window))
        mag_sum = float(np.sum(mag))
        if mag_sum > 0:
            centroids.append(float(np.sum(freqs * mag) / mag_sum))
        frame_count = 1
    else:
        for start in range(0, len(samples) - frame_size + 1, hop * step):
            frame = samples[start : start + frame_size]
            frame_rms = float(np.sqrt(np.mean(frame ** 2)))
            if frame_rms < silence_threshold:
                silent_frames += 1
            mag = np.abs(np.fft.rfft(frame * window))
            mag_sum = float(np.sum(mag))
            if mag_sum > 0:
                centroids.append(float(np.sum(freqs * mag) / mag_sum))
            frame_count += 1

    silence_ratio = float(silent_frames) / float(frame_count) if frame_count else 0.0
    spectral_centroid = float(np.mean(centroids)) if centroids else None

    return {
        "duration_s": duration,
        "sample_rate": sample_rate,
        "rms_energy": rms,
        "zero_crossing_rate": zcr,
        "spectral_centroid": spectral_centroid,
        "silence_ratio": silence_ratio,
        "clipping_ratio": clipping_ratio,
        "silence_threshold": silence_threshold,
        "clip_threshold": clip_threshold,
        "frames_analyzed": frame_count,
    }


def _score_audio(metrics):
    notes = ["audio_mvp"]
    warnings = []
    score = 0.5
    signal_strength = 0

    clip = metrics.get("clipping_ratio")
    if clip is not None:
        if clip >= 0.02:
            score += min(0.25, (clip - 0.02) * 4.0)
            signal_strength += 1
            notes.append("clipping")
        elif clip >= 0.005:
            score += min(0.1, (clip - 0.005) * 4.0)
            notes.append("minor_clipping")

    zcr = metrics.get("zero_crossing_rate")
    if zcr is not None and zcr >= 0.2:
        score += min(0.15, (zcr - 0.2) * 0.6)
        signal_strength += 1
        notes.append("high_zcr")

    silence_ratio = metrics.get("silence_ratio")
    if silence_ratio is not None and silence_ratio >= 0.75:
        score += min(0.1, (silence_ratio - 0.75) * 0.4)
        signal_strength += 1
        notes.append("high_silence")

    centroid = metrics.get("spectral_centroid")
    if centroid is not None and (centroid < 300.0 or centroid > 7000.0):
        score += 0.1
        signal_strength += 1
        notes.append("spectral_extreme")

    score = _clamp01(score)

    confidence = 0.55
    duration = metrics.get("duration_s") or 0.0
    if duration < 2.0:
        warnings.append("short_audio")
        confidence = min(confidence, 0.35)

    rms = metrics.get("rms_energy") or 0.0
    if rms < 0.01:
        warnings.append("low_energy")
        confidence = min(confidence, 0.4)

    sample_rate = metrics.get("sample_rate") or 0
    if sample_rate and sample_rate < 12000:
        warnings.append("low_sample_rate")
        confidence = min(confidence, 0.45)

    if signal_strength == 0:
        notes.append("weak_signals")
        confidence = min(confidence, 0.45)
        score = 0.5

    if confidence < 0.5:
        score = 0.5 + (score - 0.5) * (confidence / 0.5)

    return _clamp01(score), _clamp01(confidence), notes, warnings


def _build_signals(metrics):
    duration = metrics.get("duration_s")
    sample_rate = metrics.get("sample_rate")
    rms = metrics.get("rms_energy")
    zcr = metrics.get("zero_crossing_rate")
    centroid = metrics.get("spectral_centroid")
    silence_ratio = metrics.get("silence_ratio")
    clipping_ratio = metrics.get("clipping_ratio")

    meta_str = (
        f"duration_s={duration:.3f},sample_rate_hz={int(sample_rate)}"
        if duration is not None and sample_rate
        else "duration_s=unknown,sample_rate_hz=unknown"
    )

    return [
        f"audio_meta:{meta_str}",
        f"rms_energy:{rms:.6f}" if rms is not None else "rms_energy:unknown",
        f"zero_crossing_rate:{zcr:.6f}" if zcr is not None else "zero_crossing_rate:unknown",
        f"spectral_centroid_hz:{centroid:.1f}" if centroid is not None else "spectral_centroid_hz:unknown",
        f"silence_ratio:{silence_ratio:.4f}" if silence_ratio is not None else "silence_ratio:unknown",
        f"clipping_ratio:{clipping_ratio:.4f}" if clipping_ratio is not None else "clipping_ratio:unknown",
    ]


def run_audio_forensics(file_path: str):
    start = time.time()
    if not file_path or not os.path.exists(file_path):
        result = _error("file_missing")
        result["timing_ms"] = int((time.time() - start) * 1000)
        return result

    tmp_dir = ""
    try:
        samples = None
        sample_rate = None

        if file_path.lower().endswith(".wav"):
            try:
                samples, sample_rate, _ = _read_wav(file_path)
            except Exception:
                samples = None

        used_ffmpeg = False
        if samples is None:
            wav_path, meta = _extract_audio_ffmpeg(file_path)
            if not wav_path:
                result = _error(meta.get("note", "ffmpeg_extract_failed"))
                result["notes"] = meta.get("note", "ffmpeg_extract_failed")
                result["timing_ms"] = int((time.time() - start) * 1000)
                return result
            used_ffmpeg = True
            tmp_dir = meta.get("tmpdir") or ""
            try:
                samples, sample_rate, _ = _read_wav(wav_path)
            except Exception:
                result = _error("audio_decode_failed")
                result["notes"] = "audio_decode_failed"
                result["timing_ms"] = int((time.time() - start) * 1000)
                return result

        if samples is None or sample_rate is None or len(samples) == 0:
            result = _error("audio_decode_failed")
            result["notes"] = "audio_decode_failed"
            result["timing_ms"] = int((time.time() - start) * 1000)
            return result

        metrics = _compute_metrics(samples, sample_rate)
        ai_score, confidence, notes_parts, warnings = _score_audio(metrics)
        if used_ffmpeg:
            notes_parts.insert(0, "ffmpeg_decode")
        notes = ";".join(notes_parts)

        payload = {
            "engine": ENGINE_NAME,
            "status": "ok",
            "ai_likelihood": ai_score,
            "confidence": confidence,
            "signals": _build_signals(metrics),
            "notes": notes,
            "timing_ms": int((time.time() - start) * 1000),
            "available": True,
        }
        if warnings:
            payload["warning"] = ";".join(warnings)
        return payload
    finally:
        if tmp_dir:
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
            except Exception:
                pass


if __name__ == "__main__":
    test_path = (os.getenv("AIREALCHECK_AUDIO_SELFTEST") or "").strip()
    if test_path and os.path.exists(test_path):
        print(run_audio_forensics(test_path))
    else:
        print("Set AIREALCHECK_AUDIO_SELFTEST=path_to_audio.wav")
