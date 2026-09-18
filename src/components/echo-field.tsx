/*
  Echo field — the brand's core image, in two forms.

  "wave" (the hero): a wavefront seen through frosted glass, its edge
  split into red, green and blue and shimmering apart. That channel split
  is the whole effect — where two channels overlap you get the cyan and
  amber of a prism, and the separation swells and travels along the crest
  so it moves like water rather than scrolling like a banner. Sound and
  water saying the same thing.

  Everything is painted rather than filtered: the softness comes from
  stacked strokes, wide-and-faint under thin-and-bright, and the colour
  from `screen` blending over a dark ground. No SVG filter and no CSS
  filter sits over an animating layer, because either one re-rasterises
  the subtree every frame — that cost this hero half its frame rate once
  already.

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

/*
  The three channels. Saturated enough that `screen` overlaps throw real
  cyan and amber — a pastel split just reads as a smudge — but tilted
  toward the brand's warm and its lilac rather than pure RGB.
*/
const CHANNELS = [
  { c: "#ff4d6d", dx: -2.1, dy: -0.85, cls: "echo-ch-r" },
  { c: "#3ee0c0", dx: 0.25, dy: 1.05, cls: "echo-ch-g" },
  { c: "#7d63c9", dx: 2.2, dy: -0.45, cls: "echo-ch-b" },
];

/** Crests at different heights, wavelengths and phases. */
const CRESTS = [
  { y: 34, amp: 7.4, len: 1.0, phase: 0, w: 1.5, o: 0.95 },
  { y: 48, amp: 9.6, len: 0.78, phase: 1.9, w: 1.9, o: 1 },
  { y: 62, amp: 6.8, len: 1.26, phase: 3.6, w: 1.4, o: 0.8 },
  { y: 74, amp: 4.6, len: 1.7, phase: 5.1, w: 1.1, o: 0.5 },
];

/** A crest as a path: a fundamental with two harmonics on top of it. */
function crestPath(y: number, amp: number, len: number, phase: number): string {
  const pts: string[] = [];
  for (let x = -6; x <= 106; x += 2) {
    const t = (x / 100) * Math.PI * 2 * len + phase;
    const v =
      Math.sin(t) * 0.62 + Math.sin(t * 2.3 + 1.1) * 0.26 + Math.sin(t * 3.7 + 2.2) * 0.12;
    pts.push(`${x.toFixed(1)} ${(y + v * amp).toFixed(2)}`);
  }
  return `M${pts.join(" L")}`;
}

export function EchoField({
  words = [],
  variant = "ink",
  className = "",
}: {
  words?: EchoWord[];
  /** "wave" is the frosted wavefront; "ink" the soft cloud behind cards */
  variant?: "wave" | "ink";
  className?: string;
}) {
  const wave = variant === "wave";

  return (
    /*
      Position is the caller's to set — the field is used both as a block
      in the hero and as an inset halo behind a card. Hardcoding `relative`
      here silently beat callers' `absolute` in the cascade and collapsed
      every inset instance to zero height.
    */
    <div className={`overflow-hidden ${className}`} aria-hidden>
      {wave ? <Wave /> : <Ink />}

      {words.map((w) => (
        <span
          key={w.text + w.x}
          className={`font-serif-display absolute whitespace-nowrap ${
            wave ? "echo-word" : "text-ink"
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

function Wave() {
  return (
    <div className="echo-wave absolute inset-0">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {/* the ground the colour needs: screen over pale is just pale */}
          <linearGradient id="ew-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#080d17" stopOpacity="1" />
            <stop offset="45%" stopColor="#141c2e" stopOpacity="1" />
            <stop offset="100%" stopColor="#070b14" stopOpacity="1" />
          </linearGradient>

        </defs>

        <g>
          <rect width="100" height="100" fill="url(#ew-ground)" />

          {/*
            Each channel is its own layer, offset and drifting at its own
            rate. Screen blending does the prism: R over B gives magenta,
            G over B cyan, all three white at the crest.
          */}
          {CHANNELS.map((ch) => (
            <g key={ch.c} className={`echo-channel ${ch.cls}`}>
              <g transform={`translate(${ch.dx} ${ch.dy})`}>
                {CRESTS.map((cr, i) => {
                  const d = crestPath(cr.y, cr.amp, cr.len, cr.phase);
                  return (
                    <g key={i} opacity={cr.o}>
                      {/* wide and faint under thin and bright: a painted
                          glow, so no filter has to run */}
                      <path d={d} fill="none" stroke={ch.c} strokeWidth={cr.w * 5.5} opacity={0.06} />
                      <path d={d} fill="none" stroke={ch.c} strokeWidth={cr.w * 2.4} opacity={0.14} />
                      <path d={d} fill="none" stroke={ch.c} strokeWidth={cr.w} opacity={0.6} />
                      <path d={d} fill="none" stroke={ch.c} strokeWidth={cr.w * 0.34} opacity={0.95} />
                    </g>
                  );
                })}
              </g>
            </g>
          ))}
        </g>
      </svg>

      {/* the frosted pane the wave is seen through */}
      <div className="echo-frost" />
    </div>
  );
}
