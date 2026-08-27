/* Abstract generated avatars — organic arc forms, no faces, no photos. */

const PALETTES: [string, string][] = [
  ["#d9cff2", "#8f7ad1"],
  ["#f2cfd9", "#cf7d97"],
  ["#d7ddd2", "#7d8f74"],
  ["#d2d9e6", "#6e82a6"],
  ["#ecdccb", "#bd9367"],
  ["#dcd2e6", "#a67daf"],
];

export function Avatar({
  seed,
  size = 44,
  blurred = false,
}: {
  seed: number;
  size?: number;
  blurred?: boolean;
}) {
  const [bg, fg] = PALETTES[Math.abs(seed) % PALETTES.length];
  const rot = (seed * 47) % 360;
  const r1 = 30 + (seed % 12);
  const r2 = 14 + ((seed * 3) % 10);
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-full ${blurred ? "redacted" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <rect width="100" height="100" fill={bg} />
        <g transform={`rotate(${rot} 50 50)`} fill="none" stroke={fg} strokeLinecap="round">
          <path d={`M 15 62 Q 50 ${62 - r1}, 85 62`} strokeWidth="11" />
          <path d={`M 26 80 Q 50 ${80 - r2}, 74 80`} strokeWidth="9" opacity="0.7" />
          <circle cx="50" cy="32" r="7.5" fill={fg} stroke="none" opacity="0.9" />
        </g>
      </svg>
    </span>
  );
}
