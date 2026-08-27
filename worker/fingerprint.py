"""
EchoBack fingerprint worker.

Runs on a GPU host (e.g. RunPod). Pulls newly-uploaded tracks from Supabase,
computes the three component embeddings, and POSTs them to the app's
/api/fingerprint callback, which stores vectors and refreshes cached matches.

Component separation (TRD §2):
  style_vector       — CLAP embedding of the full mix
  vocal_vector       — CLAP embedding of the vocals stem (Demucs separation)
  production_vector  — CLAP embedding of the instrumental (no-vocals) stem

Env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  APP_URL                  e.g. https://echoback.world
  FINGERPRINT_WORKER_SECRET

Deps: pip install laion-clap demucs supabase requests soundfile torch
"""

import hashlib
import io
import os
import tempfile
import time

import numpy as np
import requests
from supabase import create_client

POLL_SECONDS = 15
EMBED_DIM = 512

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
app_url = os.environ["APP_URL"].rstrip("/")
worker_secret = os.environ["FINGERPRINT_WORKER_SECRET"]

_clap = None


def clap():
    """Lazy-load CLAP once per process."""
    global _clap
    if _clap is None:
        import laion_clap

        _clap = laion_clap.CLAP_Module(enable_fusion=False)
        _clap.load_ckpt()  # default pretrained checkpoint
    return _clap


def embed_file(path: str) -> np.ndarray:
    vec = clap().get_audio_embedding_from_filelist(x=[path], use_tensor=False)[0]
    vec = np.asarray(vec, dtype=np.float32)
    # L2-normalise so pgvector cosine distance behaves.
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec


def separate_stems(path: str, out_dir: str) -> tuple[str, str]:
    """Return (vocals_path, instrumental_path) via Demucs two-stem split."""
    import subprocess

    subprocess.run(
        ["python", "-m", "demucs", "--two-stems", "vocals", "-o", out_dir, path],
        check=True,
    )
    base = os.path.splitext(os.path.basename(path))[0]
    stem_dir = os.path.join(out_dir, "htdemucs", base)
    return os.path.join(stem_dir, "vocals.wav"), os.path.join(stem_dir, "no_vocals.wav")


def process_track(track: dict) -> None:
    track_id = track["id"]
    print(f"[worker] processing {track_id} ({track['title']!r})")
    supabase.table("tracks").update({"status": "processing"}).eq("id", track_id).execute()

    data = supabase.storage.from_("audio").download(track["storage_path"])
    content_hash = hashlib.sha256(data).hexdigest()

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "input" + os.path.splitext(track["storage_path"])[1])
        with open(src, "wb") as f:
            f.write(data)

        style = embed_file(src)
        try:
            vocals_path, inst_path = separate_stems(src, tmp)
            vocal = embed_file(vocals_path)
            production = embed_file(inst_path)
        except Exception as e:  # stem separation is best-effort
            print(f"[worker] demucs failed ({e}); falling back to full-mix vectors")
            vocal = style
            production = style

    resp = requests.post(
        f"{app_url}/api/fingerprint",
        headers={"x-worker-secret": worker_secret},
        json={
            "trackId": track_id,
            "contentHash": content_hash,
            "vocal": vocal.tolist(),
            "style": style.tolist(),
            "production": production.tolist(),
        },
        timeout=120,
    )
    resp.raise_for_status()
    print(f"[worker] done {track_id}")


def main() -> None:
    print("[worker] fingerprint worker up; polling for uploads…")
    while True:
        rows = (
            supabase.table("tracks")
            .select("id,title,storage_path,kind")
            .eq("status", "uploaded")
            .limit(4)
            .execute()
            .data
        )
        for track in rows:
            try:
                process_track(track)
            except Exception as e:
                print(f"[worker] FAILED {track['id']}: {e}")
                supabase.table("tracks").update({"status": "failed"}).eq("id", track["id"]).execute()
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
