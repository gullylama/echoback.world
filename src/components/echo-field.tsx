/*
  Echo field — the brand's core image, in two forms.

  "aurora" (the hero): a curtain of vertical light behind frosted glass.
  Vertical columns of varying height and brightness ARE a spectrum, so the
  same image reads as an aurora and as sound — which is the whole idea,
  said once instead of twice.

  The palette is sampled from the reference rather than invented: hues
  clustered hard in blue-violet, running out through magenta and pink to a
  little peach, with almost no green. Saturation is low — median 0.26 —
  because an aurora is pale light, and neon would read as a gradient mesh.
  It lands almost exactly on the brand's own indigo, lilac and rose.

  Everything is painted rather than filtered: softness comes from stacked
  translucent columns and `screen` blending over a dark ground. No SVG or
  CSS filter sits over an animating layer, because either one re-rasterises
  the subtree every frame — that cost this hero half its frame rate once.
  Only transforms and opacity animate, which the compositor handles.

  "ink" (behind cards): the original soft organic ink-forms, with sharp
  words surfacing from the blur. The contrast of focus and blur *is* the
  product — matches stay blurred until revealed — and behind a card the
  dark ground would fight the content sitting on it.
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

/* Deterministic: the server and the client must draw the same curtain. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
  Hue ramp taken from the reference: a little cyan at the cold edge, a long
  weighted run through blue and violet, then out through magenta and pink
  to peach and a touch of gold. Deliberately no green in the middle — the
  reference has almost none, and adding it turns an aurora into a rainbow.

  Hue is a function of POSITION, not of column index, so that overlapping
  curtains reinforce the same colour at the same x and read as bands.
  Keying it to the index instead makes every curtain span the whole ramp,
  and three full spectra averaged together just come out violet.
*/
function hueAt(t: number): number {
  if (t < 0.14) return 188 + (t / 0.14) * 24; //  cyan -> blue
  if (t < 0.52) return 212 + ((t - 0.14) / 0.38) * 48; //  blue -> violet
  if (t < 0.76) return 260 + ((t - 0.52) / 0.24) * 56; // violet -> magenta
  if (t < 0.92) return 316 + ((t - 0.76) / 0.16) * 54; // magenta -> pink
  return 370 + ((t - 0.92) / 0.08) * 28; // peach -> gold
}

interface Column {
  x: number;
  w: number;
  top: number;
  bottom: number;
  hue: number;
  sat: number;
  light: number;
  o: number;
}

/** One curtain of light: columns of differing height, a spectrum. */
function curtain(seed: number, count: number, spread: number): Column[] {
  const r = rng(seed);
  const cols: Column[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    // cluster toward the middle, thinning at the edges, as the reference does
    const x = 50 + (t - 0.5) * spread + (r() - 0.5) * 3.2;
    const fall = Math.sin(t * Math.PI); // brightest and longest at centre
    // position, not index: curtains must agree on the colour at a given x
    const place = Math.min(0.999, Math.max(0, (x - 6) / 88 + (r() - 0.5) * 0.06));
    cols.push({
      x,
      w: 0.35 + r() * 1.5,
      top: 20 + (1 - fall) * 20 + r() * 10,
      bottom: 66 + fall * 22 + r() * 8,
      hue: hueAt(place),
      sat: 62 + r() * 34,
      light: 50 + fall * 12 + r() * 9,
      o: (0.24 + fall * 0.52 + r() * 0.24) * 0.98,
    });
  }
  return cols;
}

const CURTAINS = [
  { cols: curtain(11, 34, 86), cls: "echo-curtain-a" },
  { cols: curtain(29, 26, 62), cls: "echo-curtain-b" },
  { cols: curtain(47, 18, 40), cls: "echo-curtain-c" },
];

export function EchoField({
  words = [],
  variant = "ink",
  className = "",
}: {
  words?: EchoWord[];
  /** "aurora" is the frosted light curtain; "ink" the cloud behind cards */
  variant?: "aurora" | "ink";
  className?: string;
}) {
  const aurora = variant === "aurora";

  return (
    /*
      Position is the caller's to set — the field is used both as a block
      in the hero and as an inset halo behind a card. Hardcoding `relative`
      here silently beat callers' `absolute` in the cascade and collapsed
      every inset instance to zero height.
    */
    <div className={`overflow-hidden ${className}`} aria-hidden>
      {aurora ? <Aurora /> : <Ink />}

      {words.map((w) => (
        <span
          key={w.text + w.x}
          className={`font-serif-display absolute whitespace-nowrap ${
            aurora ? "echo-word" : "text-ink"
          }`}
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

function Ink() {
  return (
    <>
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
    </>
  );
}

function Aurora() {
  return (
    <div className="echo-aurora absolute inset-0">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {/* near-black indigo at the top, lifting toward the cloud base —
              both sampled from the reference */}
          <linearGradient id="au-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b091b" />
            <stop offset="52%" stopColor="#161233" />
            <stop offset="100%" stopColor="#2b2a44" />
          </linearGradient>

          {CURTAINS.flatMap((cur, ci) =>
            cur.cols.map((c, i) => (
              <linearGradient key={`${ci}-${i}`} id={`au-c${ci}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`hsl(${c.hue} ${c.sat}% ${c.light}%)`} stopOpacity="0" />
                <stop offset="18%" stopColor={`hsl(${c.hue} ${c.sat}% ${c.light}%)`} stopOpacity="0.55" />
                <stop offset="56%" stopColor={`hsl(${c.hue + 16} ${c.sat + 6}% ${c.light + 28}%)`} stopOpacity="1" />
                <stop offset="88%" stopColor={`hsl(${c.hue + 44} ${c.sat}% ${c.light + 4}%)`} stopOpacity="0.45" />
                <stop offset="100%" stopColor={`hsl(${c.hue + 44} ${c.sat}% ${c.light}%)`} stopOpacity="0" />
              </linearGradient>
            ))
          )}
        </defs>

        <rect width="100" height="100" fill="url(#au-ground)" />

        {/*
          Three curtains drifting at their own rates. Animating the group
          rather than each column keeps this to three composited layers
          instead of seventy-eight.
        */}
        {CURTAINS.map((cur, ci) => (
          <g key={ci} className={`echo-curtain ${cur.cls}`}>
            {cur.cols.map((c, i) => (
              <rect
                key={i}
                x={c.x - c.w / 2}
                y={c.top}
                width={c.w}
                height={c.bottom - c.top}
                fill={`url(#au-c${ci}-${i})`}
                opacity={c.o}
              />
            ))}
          </g>
        ))}
      </svg>

      {/* the cloud the light falls out of, and the one it lands on */}
      <div className="echo-cloud echo-cloud--top" />
      <div className="echo-cloud echo-cloud--base" />

      {/* the frosted pane it is all seen through */}
      <div className="echo-frost" />
    </div>
  );
}
