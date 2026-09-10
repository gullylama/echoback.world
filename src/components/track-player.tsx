"use client";

/*
  Waveform player.

  With a stored file it plays the real audio through /api/audio/[trackId],
  which re-checks authorisation on every request and caps pre-reveal
  listening. Previews arrive as a plain capped stream, so there is nothing
  to seek past.

  With no stored file — demo mode only — it synthesises a short phrase from
  the track's seed through a feedback delay, so the UI is still alive with
  no backend. Real uploads never take that path.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioRef } from "@/lib/types";

const SYNTH_SECONDS = 8;

/* ---- shared: only one player sounds at a time ---- */
let activeStop: (() => void) | null = null;
function claimPlayback(stop: () => void) {
  if (activeStop && activeStop !== stop) activeStop();
  activeStop = stop;
}
function releasePlayback(stop: () => void) {
  if (activeStop === stop) activeStop = null;
}

/* ---- waveform ---- */

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A plausible shape when we have no measured peaks. */
function generatedBars(seed: number, count: number): number[] {
  const r = mulberry(seed);
  const out: number[] = [];
  let v = 0.45;
  for (let i = 0; i < count; i++) {
    v = Math.max(0.12, Math.min(1, v + (r() - 0.5) * 0.55));
    const swell = 0.6 + 0.4 * Math.sin((i / count) * Math.PI);
    out.push(v * swell);
  }
  return out;
}

/** Resample measured peaks to the number of bars we're drawing. */
function resample(peaks: number[], count: number): number[] {
  const max = peaks.reduce((m, p) => Math.max(m, p), 0) || 1;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * peaks.length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * peaks.length) / count));
    let peak = 0;
    for (let j = from; j < to && j < peaks.length; j++) peak = Math.max(peak, peaks[j]);
    out.push(Math.max(0.06, peak / max));
  }
  return out;
}

/* ---- synth fallback ---- */

const PENTATONIC = [0, 3, 5, 7, 10, 12, 15, 17];

function synthesise(ctx: AudioContext, seed: number, dest: AudioNode) {
  const r = mulberry(seed ^ 0x9e37);
  const root = 196 * Math.pow(2, Math.floor(r() * 5) / 12);
  const master = ctx.createGain();
  master.gain.value = 0.16;

  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.34;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.42;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  delay.connect(feedback).connect(delay);
  master.connect(dest);
  master.connect(delay);
  delay.connect(wet).connect(dest);

  const t0 = ctx.currentTime + 0.05;
  const step = 0.42;
  for (let i = 0; i < Math.floor(SYNTH_SECONDS / step) - 2; i++) {
    if (r() < 0.28) continue; // rests
    const osc = ctx.createOscillator();
    osc.type = r() < 0.5 ? "sine" : "triangle";
    osc.frequency.value = root * Math.pow(2, PENTATONIC[Math.floor(r() * PENTATONIC.length)] / 12);
    const env = ctx.createGain();
    const at = t0 + i * step;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.9, at + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, at + step * 1.7);
    osc.connect(env).connect(master);
    osc.start(at);
    osc.stop(at + step * 1.8);
  }
  return master;
}

/* ---- component ---- */

export function TrackPlayer({
  audio,
  seed,
  label,
  height = 40,
  barCount = 56,
  disabled = false,
  className = "",
}: {
  /** resolved server-side; omit only where a bare seed is all that exists */
  audio?: AudioRef | null;
  seed?: number;
  /** what this player is playing — pages carry several, so name them */
  label?: string;
  height?: number;
  barCount?: number;
  disabled?: boolean;
  className?: string;
}) {
  const ref: AudioRef = audio ?? { trackId: null, peaks: null, seed: seed ?? 1 };
  const isReal = Boolean(ref.trackId);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const elRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioNode | null>(null);
  const rafRef = useRef(0);
  const startedAt = useRef(0);

  const bars = ref.peaks?.length ? resample(ref.peaks, barCount) : generatedBars(ref.seed, barCount);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (elRef.current) {
      elRef.current.pause();
      elRef.current.currentTime = 0;
    }
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    setPlaying(false);
    setProgress(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      nodeRef.current?.disconnect();
      releasePlayback(stop);
    };
  }, [stop]);

  const toggle = async () => {
    if (disabled) return;

    if (playing) {
      releasePlayback(stop);
      stop();
      return;
    }

    claimPlayback(stop);

    if (isReal) {
      const el = elRef.current;
      if (!el) return;
      setFailed(false);
      setLoading(true);
      try {
        await el.play();
        setLoading(false);
        setPlaying(true);
      } catch {
        setLoading(false);
        setFailed(true);
        releasePlayback(stop);
      }
      return;
    }

    const ctx = (ctxRef.current ??= new AudioContext());
    void ctx.resume();
    nodeRef.current = synthesise(ctx, ref.seed, ctx.destination);
    startedAt.current = performance.now();
    setPlaying(true);
    const tick = () => {
      const p = (performance.now() - startedAt.current) / (SYNTH_SECONDS * 1000);
      if (p >= 1) {
        releasePlayback(stop);
        stop();
        return;
      }
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  /** Seeking is only meaningful on a full, range-served stream. */
  const seekable =
    isReal && !!elRef.current && Number.isFinite(elRef.current.duration) && elRef.current.seekable.length > 0;

  const seek = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!seekable) return;
    const el = elRef.current!;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = fraction * el.duration;
    setProgress(fraction);
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {isReal && (
        <audio
          ref={elRef}
          src={`/api/audio/${ref.trackId}`}
          preload="none"
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (Number.isFinite(el.duration) && el.duration > 0) {
              setProgress(el.currentTime / el.duration);
            }
          }}
          onEnded={() => {
            releasePlayback(stop);
            stop();
          }}
          onError={() => {
            setFailed(true);
            setLoading(false);
            setPlaying(false);
          }}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
        />
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={
          (playing ? "Pause" : failed ? "Audio unavailable" : "Play") +
          (label ? ` — ${label}` : "")
        }
        title={failed ? "This audio isn't available to you" : undefined}
        className="grid size-9 shrink-0 place-items-center rounded-full border border-hairline bg-paper-raised transition hover:border-ink-faint disabled:opacity-40"
      >
        {loading ? (
          <span className="grad-audio block size-2.5 animate-pulse rounded-full" />
        ) : failed ? (
          <span className="text-xs text-ink-faint">!</span>
        ) : playing ? (
          <span className="block size-2.5 bg-ink" />
        ) : (
          <svg width="11" height="12" viewBox="0 0 11 12" className="ml-0.5">
            <path d="M0.5 0.8 L10.5 6 L0.5 11.2 Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <svg
        className={`min-w-0 flex-1 ${seekable ? "cursor-pointer" : ""}`}
        height={height}
        viewBox={`0 0 ${barCount * 4} ${height}`}
        preserveAspectRatio="none"
        onClick={seek}
        aria-hidden
      >
        {bars.map((h, i) => {
          const active = playing && i / barCount <= progress;
          const bh = Math.max(2, h * (height - 4));
          return (
            <rect
              key={i}
              x={i * 4}
              y={(height - bh) / 2}
              width={2.2}
              height={bh}
              rx={1.1}
              fill={active ? "var(--color-lilac-deep)" : "var(--color-ink)"}
              opacity={active ? 1 : 0.22}
            />
          );
        })}
      </svg>
    </div>
  );
}
