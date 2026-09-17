/*
  Echo field — the brand's core image, in two forms.

  "aperture" (the hero): a dark well opened in the pale page. A luminous
  core with concentric interference rings running out of it, warped and
  smeared as if the whole thing were being watched through moving water.
  This is sound made visible — cymatics, a long exposure of a surface
  under a tone — which is why the core is allowed the lilac-to-rose
  gradient: here the subject genuinely is audio.

  Rings carry a warm edge against a cool body. That chromatic fringe is
  what stops concentric circles reading as a diagram and makes them read
  as light bending through water.

  "ink" (behind cards): the original soft organic ink-forms, with sharp
  words surfacing from the blur. The contrast of focus and blur *is* the
  product — matches stay blurred until revealed — and behind a card a dark
  aperture would only fight the content sitting on it.
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
  Interference rings. Spacing tightens toward the core and opens outward,
  the way standing waves actually crowd near the driver — evenly spaced
  rings read as a target, uneven ones read as a wavefront.
*/
const RINGS = [8.5, 13, 18.5, 25.5, 31, 39, 48.5, 58, 70];

export function EchoField({
  words = [],
  variant = "ink",
  className = "",
}: {
  words?: EchoWord[];
  /** "aperture" is the dark well; "ink" the soft cloud behind cards */
  variant?: "aperture" | "ink";
  className?: string;
}) {
  const aperture = variant === "aperture";

  return (
    /*
      Position is the caller's to set — the field is used both as a block
      in the hero and as an inset halo behind a card. Hardcoding `relative`
      here silently beat callers' `absolute` in the cascade and collapsed
      every inset instance to zero height.
    */
    <div className={`overflow-hidden ${className}`} aria-hidden>
      {aperture ? <Aperture /> : <Ink />}

      {words.map((w) => (
        <span
          key={w.text + w.x}
          className={`font-serif-display absolute whitespace-nowrap ${
            aperture ? "echo-word" : "text-ink"
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

function Aperture() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="echo-aperture absolute inset-0 h-full w-full"
    >
      <defs>
        {/* the well: near-black at the rim, opening to a lit centre */}
        <radialGradient id="ea-well" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1b2740" stopOpacity="0.97" />
          <stop offset="34%" stopColor="#111a2b" stopOpacity="0.99" />
          <stop offset="72%" stopColor="#080d15" stopOpacity="1" />
          <stop offset="100%" stopColor="#05080d" stopOpacity="1" />
        </radialGradient>

        {/* the core — the one place the audio gradient belongs */}
        <radialGradient id="ea-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fdf6f8" stopOpacity="0.97" />
          <stop offset="22%" stopColor="var(--color-rose)" stopOpacity="0.8" />
          <stop offset="52%" stopColor="var(--color-lilac)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--color-lilac-deep)" stopOpacity="0" />
        </radialGradient>

        {/* the hot centre */}
        <radialGradient id="ea-flame" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff4ec" stopOpacity="1" />
          <stop offset="38%" stopColor="#ffb98d" stopOpacity="0.9" />
          <stop offset="72%" stopColor="var(--color-rose-deep)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--color-rose-deep)" stopOpacity="0" />
        </radialGradient>

        {/* the halo the core throws onto the water around it */}
        <radialGradient id="ea-halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#bcd2e8" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#6d7fb0" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2a3550" stopOpacity="0" />
        </radialGradient>

        {/* water: a slow warp applied to the rings, not to the light */}
        <filter id="ea-water" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015 0.019"
            numOctaves="2"
            seed="5"
            result="warp"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="warp"
            scale="5.6"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur stdDeviation="0.85" />
        </filter>

        {/* the rim falls away to nothing — an aperture, never a tile */}
        <radialGradient id="ea-vig" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="62%" stopColor="#fff" stopOpacity="0.96" />
          <stop offset="84%" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="ea-mask">
          <rect width="100" height="100" fill="url(#ea-vig)" />
        </mask>
      </defs>

      <g mask="url(#ea-mask)">
        <rect width="100" height="100" fill="url(#ea-well)" />

        {/* radial smear — the long exposure */}
        <g className="echo-smear" opacity="0.28">
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const r0 = 16 + (i % 4) * 3;
            const r1 = 30 + (i % 5) * 6;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * r0}
                y1={50 + Math.sin(a) * r0}
                x2={50 + Math.cos(a) * r1}
                y2={50 + Math.sin(a) * r1}
                stroke={i % 3 === 0 ? "var(--color-rose)" : "#8ea6c8"}
                strokeWidth={i % 3 === 0 ? 1.6 : 2.4}
                strokeLinecap="round"
                opacity={0.07}
              />
            );
          })}
        </g>

        {/* the interference pattern */}
        <g className="echo-rings">
        <g filter="url(#ea-water)">
          {RINGS.map((r, i) => {
            const fade = 1 - i / (RINGS.length + 3);
            return (
              <g key={r}>
                {/* warm fringe, offset — light bending, not a second circle */}
                <ellipse
                  cx={50}
                  cy={50 - 0.22}
                  rx={r * 1.02}
                  ry={r * 0.96}
                  fill="none"
                  stroke="var(--color-rose-deep)"
                  strokeWidth={0.75 + i * 0.09}
                  opacity={0.52 * fade}
                />
                <ellipse
                  cx={50}
                  cy={50}
                  rx={r}
                  ry={r * 0.94}
                  fill="none"
                  stroke="#8fa8c9"
                  strokeWidth={0.5 + i * 0.06}
                  opacity={0.34 * fade}
                />
              </g>
            );
          })}
        </g>
        </g>

        <ellipse cx="50" cy="50" rx="34" ry="29" fill="url(#ea-halo)" className="echo-core-halo" />
        <g className="echo-core">
          {/* the lit body: a lens, wider than tall, as in the reference */}
          <ellipse cx="50" cy="50" rx="15" ry="10.5" fill="url(#ea-core)" />
          {/* the flame at its heart — the only place that runs truly hot */}
          <ellipse cx="50" cy="50.4" rx="2.4" ry="6.2" fill="url(#ea-flame)" />
        </g>
      </g>
    </svg>
  );
}
