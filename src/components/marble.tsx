"use client";

/*
  A track's marble.

  Static by default — drawn once by the shared renderer and shown as an
  image, because a list of twenty marbles must not be twenty WebGL
  contexts. `live` gives one its own canvas and animates it, and should be
  used for the track that is playing and nothing else.
*/

import { useEffect, useRef, useState } from "react";
import type { Marble as MarbleSeed } from "@/lib/marble";
import { createRenderer, drawMarble, marbleCss, marbleImage } from "@/lib/marble-renderer";

export function Marble({
  marble,
  size = 44,
  live = false,
  title,
  className = "",
}: {
  marble: MarbleSeed;
  size?: number;
  /** animate this one. At most one on screen at a time. */
  live?: boolean;
  /** what it is a picture of, for anyone not looking at it */
  title?: string;
  className?: string;
}) {
  const dpr = typeof window === "undefined" ? 2 : Math.min(window.devicePixelRatio || 1, 2);
  const [src, setSrc] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Static: draw once on the client. Never during render — it touches the DOM.
  useEffect(() => {
    if (live) return;
    setSrc(marbleImage(marble, size * dpr));
  }, [live, marble, size, dpr]);

  // Live: its own context, its own loop, torn down on unmount.
  useEffect(() => {
    if (!live) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;

    const r = createRenderer(canvas);
    if (!r) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const loop = () => {
      drawMarble(r, marble, (performance.now() - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    drawMarble(r, marble, 0);
    if (!reduced) raf = requestAnimationFrame(loop);

    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("webglcontextlost", onLost);
      r.gl.deleteProgram(r.prog);
      r.gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [live, marble, size, dpr]);

  const common = {
    width: size,
    height: size,
    // The CSS stand-in sits underneath: it is what shows before the first
    // draw, and all that shows without WebGL.
    background: marbleCss(marble),
  } as const;

  return (
    <span
      className={`echo-marble ${className}`}
      style={{ ...common, display: "inline-block" }}
      role="img"
      aria-label={title ? `${title} — fingerprint` : "Track fingerprint"}
    >
      {live ? (
        <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} style={{ display: "block" }} />
      ) : null}
    </span>
  );
}
