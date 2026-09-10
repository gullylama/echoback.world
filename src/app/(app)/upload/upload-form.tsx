"use client";

/*
  Upload happens in the browser, straight to storage.

  Before sending, the file is measured here: a sha256 for idempotent
  fingerprinting, its real duration, and a waveform the whole app then
  draws. The bytes never pass through the app server — Vercel caps
  serverless request bodies at 4.5MB, which no real song fits under.
*/

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { createUploadTicketAction, finaliseUploadAction } from "@/app/actions";

const MAX_BYTES = 50 * 1024 * 1024;
const PEAK_BUCKETS = 160;
const ACCEPTED = /\.(mp3|wav|m4a|mp4|ogg|oga|flac|aac)$/i;

type Phase =
  | { step: "idle" }
  | { step: "measuring" }
  | { step: "uploading"; percent: number }
  | { step: "saving" }
  | { step: "error"; message: string };

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Peak amplitude per bucket, quantised to 0–1000 for compact storage. */
function peaksFrom(buffer: AudioBuffer): number[] {
  const channel = buffer.getChannelData(0);
  const per = Math.max(1, Math.floor(channel.length / PEAK_BUCKETS));
  const out: number[] = [];
  for (let i = 0; i < PEAK_BUCKETS; i++) {
    const start = i * per;
    const end = Math.min(channel.length, start + per);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = channel[j] < 0 ? -channel[j] : channel[j];
      if (v > peak) peak = v;
    }
    out.push(Math.round(Math.min(1, peak) * 1000));
  }
  return out;
}

async function measure(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const contentHash = hex(digest);

  // Decoding is best-effort: an exotic codec still uploads, and the worker
  // backfills duration and waveform when it fingerprints.
  let durationSec = 0;
  let peaks: number[] = [];
  try {
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(bytes);
    durationSec = decoded.duration;
    peaks = peaksFrom(decoded);
    void ctx.close();
  } catch {
    /* keep the upload, lose the metadata */
  }
  return { contentHash, durationSec, peaks };
}

function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("content-type", file.type || "audio/mpeg");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage rejected the upload (${xhr.status})`));
    xhr.onerror = () => reject(new Error("The connection dropped during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
}

export function UploadForm({
  titleLabel,
  placeholder,
  demoMode,
  isCreator,
}: {
  titleLabel: string;
  placeholder: string;
  demoMode: boolean;
  isCreator: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  const busy = phase.step !== "idle" && phase.step !== "error";

  const pick = useCallback((next: File | null) => {
    setPhase({ step: "idle" });
    if (!next) return setFile(null);
    if (!ACCEPTED.test(next.name)) {
      setPhase({ step: "error", message: "That file type isn't supported — use mp3, wav, m4a, ogg or flac." });
      return setFile(null);
    }
    if (next.size > MAX_BYTES) {
      setPhase({ step: "error", message: "That file is over 50MB. Bounce it down and try again." });
      return setFile(null);
    }
    setFile(next);
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) return;
    if (!demoMode && !file) {
      setPhase({ step: "error", message: "Choose an audio file first." });
      return;
    }

    try {
      let measured = { contentHash: "", durationSec: 0, peaks: [] as number[] };
      let path = "";

      if (file) {
        setPhase({ step: "measuring" });
        measured = await measure(file);

        const ext = file.name.split(".").pop() ?? "mp3";
        const ticket = await createUploadTicketAction(ext);
        if (!ticket.ok) throw new Error("Your session expired — sign in again.");

        if (ticket.ticket) {
          setPhase({ step: "uploading", percent: 0 });
          await putWithProgress(ticket.ticket.signedUrl, file, (percent) =>
            setPhase({ step: "uploading", percent })
          );
          path = ticket.ticket.path;
        }
      }

      setPhase({ step: "saving" });
      const result = await finaliseUploadAction({
        title,
        path,
        contentHash: measured.contentHash,
        byteSize: file?.size ?? 0,
        durationSec: measured.durationSec,
        peaks: measured.peaks,
      });
      if (!result.ok) {
        throw new Error(
          result.reason === "auth"
            ? "Your session expired — sign in again."
            : "We couldn't save that upload. Try again."
        );
      }
      router.push(result.next);
    } catch (err) {
      setPhase({
        step: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} className="mt-10 flex flex-col gap-6">
      <label
        className={`group flex flex-col items-center rounded-2xl border border-dashed border-hairline bg-paper-raised px-6 py-12 text-center transition ${
          busy ? "opacity-60" : "cursor-pointer hover:border-ink-faint"
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy) pick(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <span className="grad-audio block h-[3px] w-16 rounded-full transition group-hover:w-24" />
        <span className="mt-5 text-sm font-medium">
          {file ? file.name : "Drop audio here, or browse"}
        </span>
        <span className="mt-1.5 text-xs text-ink-faint">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)}MB`
            : `mp3 · wav · m4a · ogg · flac — up to 50MB${demoMode ? " (optional in demo mode)" : ""}`}
        </span>
        <input
          type="file"
          accept=".mp3,.wav,.m4a,.mp4,.ogg,.oga,.flac,.aac,audio/*"
          className="sr-only"
          tabIndex={-1}
          disabled={busy}
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="label text-ink-faint">{titleLabel}</span>
        <input
          name="title"
          required
          maxLength={80}
          placeholder={placeholder}
          disabled={busy}
          className="rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint disabled:opacity-60"
        />
      </label>

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-hairline bg-paper-raised p-5">
        <legend className="label px-1 text-ink-faint">Rights &amp; consent</legend>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <input type="checkbox" name="rights" required className="mt-1 accent-[var(--color-lilac-deep)]" />
          I own or control the rights to this audio and I&rsquo;m allowed to share it here.
        </label>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
          <input type="checkbox" name="consent" required className="mt-1 accent-[var(--color-lilac-deep)]" />
          {isCreator
            ? "I consent to EchoBack fingerprinting this track and surfacing short previews of it to matched artists and producers."
            : "I consent to EchoBack fingerprinting this upload so tracks can be matched to my sound. My work is never shared in full — only a short preview, and only to people you've matched with."}
        </label>
      </fieldset>

      {phase.step === "error" && (
        <p className="rounded-xl border border-rose-deep/40 bg-paper-raised px-4 py-3 text-sm text-rose-deep">
          {phase.message}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="relative overflow-hidden rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition hover:bg-ink-soft disabled:opacity-80"
      >
        {phase.step === "measuring" && (
          <span className="flex items-center justify-center gap-3">
            <span className="grad-audio block h-[3px] w-10 animate-pulse rounded-full" />
            Reading the waveform…
          </span>
        )}
        {phase.step === "uploading" && (
          <span className="flex items-center justify-center gap-3">
            <span className="block h-[3px] w-24 overflow-hidden rounded-full bg-paper/30">
              <span
                className="grad-audio block h-full transition-all"
                style={{ width: `${phase.percent}%` }}
              />
            </span>
            Uploading {phase.percent}%
          </span>
        )}
        {phase.step === "saving" && (
          <span className="flex items-center justify-center gap-3">
            <span className="grad-audio block h-[3px] w-10 animate-pulse rounded-full" />
            Handing it to the engine…
          </span>
        )}
        {(phase.step === "idle" || phase.step === "error") &&
          (isCreator ? "Upload & run the engine" : "Upload to my reference library")}
      </button>
    </form>
  );
}
