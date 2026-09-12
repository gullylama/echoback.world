/*
  Echo field — the brand's core image.

  An echo rising through water to a frosted surface. Everything here is
  light rather than line: the forms are blurred blooms, never outlines, so
  it reads as something seen through frosted glass rather than a diagram
  of a jellyfish. Structure is only just discernible — three nested arcs,
  the mark's own shape — which is what makes it register as sound and as
  marine life at once.

  Depth is the grammar. Deep forms are small, cold and heavily diffused;
  as they rise they widen, warm toward purple, and sharpen a little. At the
  top they bloom against the surface, and that is where the words come
  through clear.

  Purple is used solid, as life. The lilac-to-rose gradient stays reserved
  for audio itself.
*/

export interface EchoWord {
  text: string;
  x: number;
  y: number;
  /** 1 = fully surfaced; lower values sink back into the blur */
  fade?: number;
  blur?: number; // px
  size?: number; // rem
}

const LILAC = "#ab95e8";
const LILAC_DEEP = "#7d63c9";
const INDIGO = "#34315c";
const COOL = "#6f6aa8";

interface Bloom {
  x: number;
  y: number;
  r: number;
  /** 0 = deep and cold, 1 = surfaced and warm */
  depth: number;
  /** which blur band it sits in */
  band: 0 | 1 | 2;
  drift?: number;
  delay?: number;
}

/*
  Hand-placed. A generated arrangement reads as noise; the eye wants a
  path through it — one dominant bloom just under the surface, a couple
  answering it, and smaller ones falling away into the dark.
*/
const BLOOMS: Bloom[] = [
  { x: 52, y: 34, r: 26, depth: 1, band: 0, drift: 19, delay: 0 },
  { x: 23, y: 47, r: 17, depth: 0.72, band: 1, drift: 23, delay: -7 },
  { x: 78, y: 44, r: 14, depth: 0.62, band: 1, drift: 21, delay: -13 },
  { x: 41, y: 66, r: 11, depth: 0.36, band: 2, drift: 27, delay: -4 },
  { x: 69, y: 74, r: 9, depth: 0.26, band: 2, drift: 29, delay: -17 },
  { x: 15, y: 76, r: 7.5, depth: 0.18, band: 2, drift: 31, delay: -10 },
];

function tint(depth: number): string {
  if (depth > 0.85) return LILAC_DEEP;
  if (depth > 0.55) return LILAC;
  if (depth > 0.3) return COOL;
  return INDIGO;
}

/** A bloom: a lit dome, the mark's three arcs barely showing, soft trails. */
function Bloom({ b, i }: { b: Bloom; i: number }) {
  const c = tint(b.depth);
  const rings = [1, 0.68, 0.54].map((k) => b.r * k);
  const drops = [0, b.r * 0.17, b.r * 0.3];
  const reach = b.r * (1.1 + b.depth * 0.7);

  const trails = [-0.6, -0.24, 0.18, 0.56].map((t, n) => {
    const fx = b.x + b.r * t;
    const fy = b.y + b.r * 0.5;
    const sway = b.r * 0.26 * (n % 2 === 0 ? 1 : -1);
    return `M${fx.toFixed(1)} ${fy.toFixed(1)} C${(fx + sway).toFixed(1)} ${(fy + reach * 0.38).toFixed(1)} ${(fx - sway).toFixed(1)} ${(fy + reach * 0.7).toFixed(1)} ${(fx + sway * 0.3).toFixed(1)} ${(fy + reach).toFixed(1)}`;
  });

  return (
    <g
      className={b.drift ? "echo-bloom" : undefined}
      style={
        b.drift
          ? { animationDuration: `${b.drift}s`, animationDelay: `${b.delay ?? 0}s` }
          : undefined
      }
    >
      {/* the light of the thing — this is what you actually read */}
      <ellipse
        cx={b.x}
        cy={b.y + b.r * 0.3}
        rx={b.r * 1.15}
        ry={b.r * 0.8}
        fill={`url(#eb-glow-${i})`}
      />

      {trails.map((d, n) => (
        <path
          key={n}
          d={d}
          fill="none"
          stroke={c}
          strokeWidth={b.r * 0.05}
          strokeLinecap="round"
          opacity={0.1 + b.depth * 0.14}
        />
      ))}

      {rings.map((rr, n) => (
        <path
          key={n}
          d={`M${(b.x - rr).toFixed(1)} ${(b.y + drops[n]).toFixed(1)} A ${rr.toFixed(1)} ${rr.toFixed(1)} 0 0 1 ${(b.x + rr).toFixed(1)} ${(b.y + drops[n]).toFixed(1)}`}
          fill="none"
          stroke={c}
          strokeWidth={b.r * (0.075 - n * 0.012)}
          strokeLinecap="round"
          opacity={(0.16 + b.depth * 0.26) * (1 - n * 0.16)}
        />
      ))}
    </g>
  );
}

export function EchoField({
  words = [],
  variant = "hero",
  className = "",
}: {
  words?: EchoWord[];
  /**
   * "hero" is the full image: the surface, the meniscus, words coming
   * through. "ambient" is the same water with no surface — for sitting
   * behind a card, where a second horizon would only fight it.
   */
  variant?: "hero" | "ambient";
  className?: string;
}) {
  const ambient = variant === "ambient";
  const bands: Bloom[][] = [[], [], []];
  BLOOMS.forEach((b) => bands[b.band].push(b));

  return (
    /*
      Position is the caller's to set — the field is used both as a block
      in the hero and as an inset halo behind a card. Hardcoding `relative`
      here silently beat callers' `absolute` in the cascade and collapsed
      the halo to zero height.
    */
    <div
      className={`echo-field ${ambient ? "echo-field--ambient" : ""} overflow-hidden ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {BLOOMS.map((b, i) => (
            <radialGradient key={i} id={`eb-glow-${i}`}>
              <stop offset="0%" stopColor={tint(b.depth)} stopOpacity={0.38 + b.depth * 0.22} />
              <stop offset="48%" stopColor={tint(b.depth)} stopOpacity={0.15 + b.depth * 0.1} />
              <stop offset="100%" stopColor={tint(b.depth)} stopOpacity="0" />
            </radialGradient>
          ))}

          {/* three depths of diffusion — the water between you and the form */}
          <filter id="eb-near" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="0.9" />
          </filter>
          <filter id="eb-mid" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.9" />
          </filter>
          <filter id="eb-far" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.4" />
          </filter>

          <filter id="eb-caustic" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.009 0.042"
              numOctaves="2"
              seed="11"
              result="n"
            />
            <feColorMatrix
              in="n"
              type="matrix"
              values="0 0 0 0 0.48  0 0 0 0 0.40  0 0 0 0 0.79  0 0 0 -1.5 0.58"
            />
            <feGaussianBlur stdDeviation="0.5" />
          </filter>

          {/* the dark falling away below — a shape, not a full-bleed fill,
              so the field never draws its own rectangle */}
          <radialGradient id="eb-depth" cx="50%" cy="96%" r="72%">
            <stop offset="0%" stopColor="#232145" stopOpacity="0.2" />
            <stop offset="60%" stopColor={INDIGO} stopOpacity="0.07" />
            <stop offset="100%" stopColor={INDIGO} stopOpacity="0" />
          </radialGradient>

          {/* everything fades at the frame; nothing touches an edge */}
          <radialGradient id="eb-vignette" cx="50%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="58%" stopColor="#fff" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="eb-mask">
            <rect width="100" height="100" fill="url(#eb-vignette)" />
          </mask>
        </defs>

        <ellipse cx="50" cy="96" rx="72" ry="56" fill="url(#eb-depth)" />

        <g mask="url(#eb-mask)">
        <g filter="url(#eb-far)">
          {bands[2].map((b) => (
            <Bloom key={`${b.x}-${b.y}`} b={b} i={BLOOMS.indexOf(b)} />
          ))}
        </g>
        <g filter="url(#eb-mid)">
          {bands[1].map((b) => (
            <Bloom key={`${b.x}-${b.y}`} b={b} i={BLOOMS.indexOf(b)} />
          ))}
        </g>
        <g filter="url(#eb-near)">
          {bands[0].map((b) => (
            <Bloom key={`${b.x}-${b.y}`} b={b} i={BLOOMS.indexOf(b)} />
          ))}
        </g>

        {/* light broken by a moving surface, falling on everything below */}
        {/* light broken by a moving surface, falling on everything below */}
        <rect
          width="100"
          height="52"
          filter="url(#eb-caustic)"
          opacity="0.5"
          className="echo-caustic"
        />
        </g>
      </svg>

      {/* The surface the echo blooms against — hero only. */}
      {!ambient && <div className="echo-surface" />}

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
