"""
EchoBack fingerprint worker.

Polls for uploaded tracks, turns each into the three component embeddings the
matching engine compares, cuts a preview clip, and posts everything back to
the app — which stores the vectors and refreshes cached matches.

Component separation (TRD §2):
  style_vector       CLAP embedding of the full mix
  vocal_vector       CLAP embedding of the vocals stem (Demucs)
  production_vector  CLAP embedding of the instrumental stem

Every vector is L2-normalised so pgvector's cosine distance behaves.

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  APP_URL                    e.g. https://echoback.world
  FINGERPRINT_WORKER_SECRET  shared with the app
  POLL_SECONDS               optional, default 15
  PREVIEW_SECONDS            optional, default 30

Install:
  pip install -r worker/requirements.txt
  (ffmpeg must be on PATH)
"""

import hashlib
import os
import subprocess
import tempfile
import time
import traceback

import numpy as np
import requests
from supabase import create_client

POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "15"))
PREVIEW_SECONDS = int(os.environ.get("PREVIEW_SECONDS", "30"))
PEAK_BUCKETS = 160
BUCKET = "audio"

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
app_url = os.environ["APP_URL"].rstrip("/")
worker_secret = os.environ["FINGERPRINT_WORKER_SECRET"]

_clap = None


def clap():
    """Load CLAP once per process — it is the expensive part."""
    global _clap
    if _clap is None:
        import laion_clap

        print("[worker] loading CLAP…", flush=True)
        _clap = laion_clap.CLAP_Module(enable_fusion=False)
        _clap.load_ckpt()
    return _clap


def l2(vec) -> list:
    vec = np.asarray(vec, dtype=np.float32).flatten()
    norm = float(np.linalg.norm(vec))
    return (vec / norm).tolist() if norm > 0 else vec.tolist()


def embed(path: str) -> list:
    return l2(clap().get_audio_embedding_from_filelist(x=[path], use_tensor=False)[0])


def separate_stems(path: str, out_dir: str):
    """Two-stem Demucs split. Returns (vocals, instrumental) paths."""
    subprocess.run(
        ["python", "-m", "demucs", "--two-stems", "vocals", "-o", out_dir, path],
        check=True,
        capture_output=True,
    )
    base = os.path.splitext(os.path.basename(path))[0]
    stem_dir = os.path.join(out_dir, "htdemucs", base)
    return os.path.join(stem_dir, "vocals.wav"), os.path.join(stem_dir, "no_vocals.wav")


def make_preview(src: str, dest: str) -> bool:
    """Cut the opening seconds to a small mp3. Best-effort."""
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", src, "-t", str(PREVIEW_SECONDS),
             "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", dest],
            check=True,
            capture_output=True,
        )
        return os.path.exists(dest) and os.path.getsize(dest) > 0
    except Exception as e:
        print(f"[worker] preview failed: {e}", flush=True)
        return False


def measure(path: str):
    """Duration and a coarse waveform, for tracks the browser could not decode."""
    try:
        import librosa

        y, sr = librosa.load(path, sr=None, mono=True)
        duration = float(len(y) / sr) if sr else 0.0
        per = max(1, len(y) // PEAK_BUCKETS)
        peaks = [
            int(min(1.0, float(np.abs(y[i * per : (i + 1) * per]).max() if len(y[i * per : (i + 1) * per]) else 0)) * 1000)
            for i in range(PEAK_BUCKETS)
        ]
        return duration, peaks
    except Exception as e:
        print(f"[worker] measure failed: {e}", flush=True)
        return None, None


def process(track: dict) -> None:
    track_id = track["id"]
    print(f"[worker] {track_id} — {track['title']!r}", flush=True)
    supabase.table("tracks").update({"status": "processing"}).eq("id", track_id).execute()

    data = supabase.storage.from_(BUCKET).download(track["storage_path"])
    content_hash = hashlib.sha256(data).hexdigest()

    with tempfile.TemporaryDirectory() as tmp:
        ext = os.path.splitext(track["storage_path"])[1] or ".mp3"
        src = os.path.join(tmp, f"input{ext}")
        with open(src, "wb") as f:
            f.write(data)

        style = embed(src)
        try:
            vocals_path, inst_path = separate_stems(src, tmp)
            vocal = embed(vocals_path)
            production = embed(inst_path)
        except Exception as e:
            print(f"[worker] demucs unavailable ({e}); using full-mix vectors", flush=True)
            vocal = style
            production = style

        preview_path = None
        clip = os.path.join(tmp, "preview.mp3")
        if make_preview(src, clip):
            dest = f"{os.path.splitext(track['storage_path'])[0]}.preview.mp3"
            with open(clip, "rb") as f:
                supabase.storage.from_(BUCKET).upload(
                    dest, f.read(),
                    {"content-type": "audio/mpeg", "upsert": "true"},
                )
            preview_path = dest

        duration, peaks = (None, None)
        if not track.get("duration_sec") or not track.get("peaks"):
            duration, peaks = measure(src)

    resp = requests.post(
        f"{app_url}/api/fingerprint",
        headers={"x-worker-secret": worker_secret},
        json={
            "trackId": track_id,
            "contentHash": content_hash,
            "vocal": vocal,
            "style": style,
            "production": production,
            "previewPath": preview_path,
            "durationSec": duration,
            "byteSize": len(data),
            "peaks": peaks,
        },
        timeout=120,
    )
    resp.raise_for_status()
    print(f"[worker] {track_id} done", flush=True)


def main() -> None:
    print("[worker] up; polling for uploads…", flush=True)
    while True:
        try:
            rows = (
                supabase.table("tracks")
                .select("id,title,storage_path,kind,duration_sec,peaks")
                .eq("status", "uploaded")
                .limit(4)
                .execute()
                .data
            )
        except Exception as e:
            print(f"[worker] poll failed: {e}", flush=True)
            time.sleep(POLL_SECONDS)
            continue

        for track in rows:
            try:
                process(track)
            except Exception:
                print(f"[worker] FAILED {track['id']}", flush=True)
                traceback.print_exc()
                supabase.table("tracks").update({"status": "failed"}).eq("id", track["id"]).execute()

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
