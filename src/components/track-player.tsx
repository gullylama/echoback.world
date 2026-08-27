"use client";

/*
  Waveform + preview player.
  In demo mode there is no real audio, so the preview is synthesised with
  WebAudio: a short pentatonic phrase derived deterministically from the
  track's seed, played through a feedback delay — every track literally
  answers with an echo. In production this component swaps to the signed
  preview-clip URL.
*/

import { useEffect, useRef, useState } from "react";

const PREVIEW_SECONDS = 8;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bars(seed: number, count: number): number[] {
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

const PENTATONIC = [0, 3, 5, 7, 10, 12, 15, 17];

function synthesise(ctx: AudioContext, seed: number, dest: AudioNode) {
  const r = mulberry(seed ^ 0x9e37);
  const root = 196 * Math.pow(2, Math.floor(r() * 5) / 12); // G3-ish root
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
  for (let i = 0; i < Math.floor(PREVIEW_SECONDS / step) - 2; i++) {
    if (r() < 0.28) continue; // rests — ma
    const note = PENTATONIC[Math.floor(r() * PENTATONIC.length)];
    const freq = root * Math.pow(2, note / 12);
    const osc = ctx.createOscillator();
    osc.type = r() < 0.5 ? "sine" : "triangle";
    osc.frequency.value = freq;
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

export function TrackPlayer({
  seed,
  height = 40,
  barCount = 56,
  disabled = false,
  className = "",
}: {
  seed: number;
  height?: number;
  barCount?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<AudioNode | null>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const heights = bars(seed, barCount);

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    nodeRef.current?.disconnect();
    nodeRef.current = null;
    setPlaying(false);
    setProgress(0);
  };

  useEffect(() => () => stop(), []);

  const toggle = () => {
    if (disabled) return;
    if (playing) return stop();
    const ctx = (ctxRef.current ??= new AudioContext());
    void ctx.resume();
    nodeRef.current = synthesise(ctx, seed, ctx.destination);
    startRef.current = performance.now();
    setPlaying(true);
    const tick = () => {
      const p = (performance.now() - startRef.current) / (PREVIEW_SECONDS * 1000);
      if (p >= 1) return stop();
      setProgress(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={playing ? "Stop preview" : "Play preview"}
        className="grid size-9 shrink-0 place-items-center rounded-full border border-hairline bg-paper-raised transition hover:border-ink-faint disabled:opacity-40"
      >
        {playing ? (
          <span className="block size-2.5 bg-ink" />
        ) : (
          <svg width="11" height="12" viewBox="0 0 11 12" className="ml-0.5">
            <path d="M0.5 0.8 L10.5 6 L0.5 11.2 Z" fill="currentColor" />
          </svg>
        )}
      </button>
      <svg
        className="min-w-0 flex-1"
        height={height}
        viewBox={`0 0 ${barCount * 4} ${height}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {heights.map((h, i) => {
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
