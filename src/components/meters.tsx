/* Similarity display — the returning echo, always in the audio gradient. */

export function SimilarityBadge({ score, size = "md" }: { score: number; size?: "md" | "lg" }) {
  return (
    <span
      className={`font-mono font-medium tabular-nums grad-audio-text ${
        size === "lg" ? "text-3xl" : "text-lg"
      }`}
    >
      {Math.round(score)}
      <span className="text-[0.65em]">%</span>
    </span>
  );
}

export function ComponentBars({
  vocal,
  style,
  production,
  talentRole,
}: {
  vocal: number;
  style: number;
  production: number;
  talentRole: "artist" | "producer" | "creator";
}) {
  const rows: [string, number][] =
    talentRole === "producer"
      ? [
          ["Production", production],
          ["Style", style],
        ]
      : [
          ["Voice", vocal],
          ["Style", style],
        ];
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map(([name, v]) => (
        <div key={name} className="flex items-center gap-2">
          <span className="label w-[4.5rem] text-ink-faint">{name}</span>
          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-mist">
            <span className="grad-audio block h-full rounded-full" style={{ width: `${v}%` }} />
          </span>
          <span className="w-8 text-right font-mono text-xs tabular-nums text-ink-soft">
            {Math.round(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Concentric echo rings — the send/return motif. */
export function EchoPulse({ size = 120, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="grad-audio absolute inset-0 animate-pulse-ring rounded-full"
          style={{ animationDelay: `${i * 1.05}s`, opacity: 0, filter: "blur(6px)" }}
        />
      ))}
      <span className="grad-audio absolute inset-[42%] rounded-full" style={{ filter: "blur(1.5px)" }} />
    </span>
  );
}
