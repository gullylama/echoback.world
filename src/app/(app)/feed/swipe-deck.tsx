"use client";

/*
  The swipe deck — talent triages demos with a low-friction gesture.
  Drag right = interested, left = pass; buttons do the same. On mutual
  interest an "echo returned" overlay links straight to the new thread.
*/

import Link from "next/link";
import { useRef, useState } from "react";
import { interestAction, passAction } from "@/app/actions";
import type { FeedItemView } from "@/lib/types";
import { TrackPlayer } from "@/components/track-player";
import { fmtDuration } from "@/lib/format";

const THRESHOLD = 90;

export function SwipeDeck({ initialItems }: { initialItems: FeedItemView[] }) {
  const [items, setItems] = useState(initialItems);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [mutualThread, setMutualThread] = useState<{ title: string } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const top = items[0];

  const commit = (dir: 1 | -1) => {
    if (!top || leaving) return;
    setLeaving({ id: top.id, dir });
    const item = top;
    if (dir === 1) {
      void interestAction(item.id).then((res) => {
        if (res?.mutual) setMutualThread({ title: item.demo.title });
      });
    } else {
      void passAction(item.id);
    }
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setLeaving(null);
      setDrag(null);
    }, 260);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: (e.clientY - start.current.y) * 0.3 });
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    if (drag && Math.abs(drag.x) > THRESHOLD) commit(drag.x > 0 ? 1 : -1);
    else setDrag(null);
  };

  if (items.length === 0 && !mutualThread) {
    return (
      <p className="mt-14 text-center text-sm text-ink-soft">
        That&rsquo;s everything — beautifully triaged.
      </p>
    );
  }

  return (
    <div className="relative mx-auto mt-10 max-w-sm">
      <div className="relative h-[26rem]">
        {items
          .slice(0, 3)
          .map((item, i) => {
            const isTop = i === 0;
            const isLeaving = leaving?.id === item.id;
            const x = isTop ? (isLeaving ? leaving!.dir * 520 : drag?.x ?? 0) : 0;
            const y = isTop ? drag?.y ?? 0 : i * 12;
            const rot = isTop ? x / 22 : (i % 2 ? 1 : -1) * i * 1.5;
            const lean = isTop && drag ? Math.max(-1, Math.min(1, drag.x / THRESHOLD)) : 0;
            return (
              <div
                key={item.id}
                className="absolute inset-x-0 touch-none select-none rounded-2xl border border-hairline bg-paper-raised p-6 shadow-[0_20px_50px_-30px_rgba(22,21,26,0.4)]"
                style={{
                  transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${1 - i * 0.035})`,
                  zIndex: 10 - i,
                  opacity: isLeaving ? 0 : 1,
                  transition: drag && isTop && !isLeaving ? "none" : "transform 0.26s ease, opacity 0.26s ease",
                }}
                onPointerDown={isTop ? onPointerDown : undefined}
                onPointerMove={isTop ? onPointerMove : undefined}
                onPointerUp={isTop ? onPointerUp : undefined}
                onPointerCancel={isTop ? onPointerUp : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="label text-ink-faint">Matched demo</span>
                  <span className="font-mono text-2xl font-medium tabular-nums grad-audio-text">
                    {Math.round(item.scores.blended)}
                    <span className="text-sm">%</span>
                  </span>
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">{item.demo.title}</h2>
                <p className="mt-1 text-sm text-ink-faint">
                  by {item.demo.creatorName} · {item.demo.genres.join(", ")} ·{" "}
                  {fmtDuration(item.demo.durationSec)}
                </p>
                <TrackPlayer seed={item.demo.seed} className="mt-6" height={48} />
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-hairline pt-4 text-center">
                  <div>
                    <p className="label text-ink-faint">{item.scores.vocal ? "Voice" : "Production"}</p>
                    <p className="mt-1 font-mono text-sm tabular-nums text-ink-soft">
                      {Math.round(item.scores.vocal || item.scores.production)}
                    </p>
                  </div>
                  <div>
                    <p className="label text-ink-faint">Style</p>
                    <p className="mt-1 font-mono text-sm tabular-nums text-ink-soft">
                      {Math.round(item.scores.style)}
                    </p>
                  </div>
                </div>
                {isTop && lean !== 0 && (
                  <span
                    className={`absolute top-4 ${lean > 0 ? "left-4" : "right-4"} rounded-full border px-3 py-1 text-xs font-semibold ${
                      lean > 0
                        ? "border-transparent grad-audio text-white"
                        : "border-hairline text-ink-faint"
                    }`}
                    style={{ opacity: Math.abs(lean) }}
                  >
                    {lean > 0 ? "Interested" : "Pass"}
                  </span>
                )}
              </div>
            );
          })
          .reverse()}
      </div>

      <div className="mt-8 flex items-center justify-center gap-5">
        <button
          onClick={() => commit(-1)}
          aria-label="Pass"
          className="grid place-items-center rounded-full border border-hairline bg-paper-raised text-lg text-ink-faint transition hover:border-ink-faint hover:text-ink"
          style={{ width: 52, height: 52 }}
        >
          ✕
        </button>
        <button
          onClick={() => commit(1)}
          aria-label="Interested"
          className="grad-audio grid place-items-center rounded-full text-white shadow-lg transition hover:opacity-90"
          style={{ width: 62, height: 62 }}
        >
          <svg width="22" height="20" viewBox="0 0 24 22" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">
        Drag the card, or use the buttons. Interest is only visible if it&rsquo;s mutual.
      </p>

      {mutualThread && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-night/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-rise rounded-2xl border border-hairline bg-paper-raised p-8 text-center">
            <span className="grad-audio mx-auto block h-[3px] w-14 rounded-full" />
            <h3 className="mt-6 text-2xl font-semibold tracking-tight">The echo returned</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              The creator of &ldquo;{mutualThread.title}&rdquo; is interested too. A
              thread is open in your inbox.
            </p>
            <div className="mt-7 flex flex-col gap-2">
              <Link
                href="/inbox"
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-soft"
              >
                Open inbox
              </Link>
              <button
                onClick={() => setMutualThread(null)}
                className="px-5 py-2 text-sm text-ink-faint transition hover:text-ink"
              >
                Keep swiping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
