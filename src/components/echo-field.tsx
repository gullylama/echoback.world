/*
  Echo field — the brand's core image: sound as soft organic ink-forms,
  with sharp words surfacing from the blur. The contrast of focus and
  blur *is* the product (matches stay blurred until revealed).
*/

interface Blob {
  x: number; // % of container
  y: number;
  w: number; // % width
  h: number;
  c: string;
  o: number; // opacity
  drift?: boolean;
}

export interface EchoWord {
  text: string;
  x: number;
  y: number;
  /** 1 = fully surfaced; lower values sink back into the blur */
  fade?: number;
  blur?: number; // px
  size?: number; // rem
}

const INK = "var(--color-indigo)";
const INK_DEEP = "var(--color-indigo-deep)";
const INK_SOFT = "#4b4880";

/*
  One connected ink-cloud with a meandering light channel through it —
  the words surface in the channel, the way sound finds its way through.
*/
const DEFAULT_BLOBS: Blob[] = [
  /* connective haze — makes the cores read as one organic mass */
  { x: 12, y: 8, w: 66, h: 52, c: INK_SOFT, o: 0.3 },
  { x: 8, y: 36, w: 72, h: 50, c: INK_SOFT, o: 0.28 },
  { x: 24, y: 20, w: 56, h: 58, c: INK, o: 0.18 },
  /* cores */
  { x: 30, y: 7, w: 18, h: 13, c: INK, o: 0.85 },
  { x: 55, y: 9, w: 22, h: 14, c: INK_DEEP, o: 0.9, drift: true },
  { x: 18, y: 18, w: 36, h: 17, c: INK_DEEP, o: 0.95 },
  { x: 60, y: 21, w: 24, h: 15, c: INK, o: 0.85 },
  { x: 8, y: 32, w: 28, h: 16, c: INK, o: 0.85 },
  { x: 64, y: 35, w: 22, h: 14, c: INK_SOFT, o: 0.7, drift: true },
  { x: 18, y: 44, w: 32, h: 17, c: INK_DEEP, o: 0.95 },
  { x: 50, y: 47, w: 28, h: 16, c: INK, o: 0.9 },
  { x: 6, y: 55, w: 20, h: 13, c: INK_SOFT, o: 0.6 },
  { x: 36, y: 61, w: 28, h: 16, c: INK_DEEP, o: 0.9, drift: true },
  { x: 64, y: 59, w: 18, h: 12, c: INK, o: 0.75 },
  { x: 26, y: 74, w: 26, h: 13, c: INK, o: 0.8 },
  /* the audio hint — one warm breath of the gradient inside the ink */
  { x: 48, y: 30, w: 16, h: 11, c: "var(--color-lilac-deep)", o: 0.35 },
  { x: 52, y: 66, w: 16, h: 10, c: "var(--color-rose-deep)", o: 0.28 },
];

export function EchoField({
  words = [],
  className = "",
}: {
  words?: EchoWord[];
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden>
      {DEFAULT_BLOBS.map((b, i) => (
        <span
          key={i}
          className={b.drift ? "animate-drift" : undefined}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.w}%`,
            height: `${b.h}%`,
            background: `radial-gradient(closest-side, ${b.c} 34%, transparent 82%)`,
            opacity: b.o,
            filter: "blur(17px)",
          }}
        />
      ))}
      {words.map((w) => (
        <span
          key={w.text + w.x}
          className="font-serif-display absolute whitespace-nowrap text-ink"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            fontSize: `${w.size ?? 2}rem`,
            opacity: w.fade ?? 1,
            filter: w.blur ? `blur(${w.blur}px)` : undefined,
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
}
