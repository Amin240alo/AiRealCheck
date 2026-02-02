import shutil
import subprocess


def main():
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("ffmpeg: not found in PATH")
        return 1
    try:
        proc = subprocess.run(
            [ffmpeg, "-version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5,
            check=False,
        )
    except Exception as exc:
        print(f"ffmpeg: error ({type(exc).__name__})")
        return 1
    if proc.returncode != 0:
        print(f"ffmpeg: error (exit={proc.returncode})")
        return 1
    line = (proc.stdout.decode("utf-8", errors="ignore") or "").splitlines()
    print(f"ffmpeg: ok ({line[0] if line else 'version unknown'})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
