/*
  The EchoBack mark, traced from the supplied artwork: three nested arcs —
  the echo returning — with a dorsal fin rising from the outermost one.
  Monochrome by design: it inherits currentColor, and the lilac→rose
  gradient stays reserved for audio itself.
*/

export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <g stroke="currentColor" strokeWidth="3.7" strokeLinecap="round" fill="none">
        <path d="M6.03 27.7 A 22.4 22.4 0 0 1 42.17 27.7" />
        <path d="M11 32.3 A 15.2 15.2 0 0 1 37.2 32.3" />
        <path d="M14.3 36.5 A 12.1 12.1 0 0 1 33.9 36.5" />
      </g>
      <path
        fill="currentColor"
        d="M19.4 16.4 C 18.95 13 19.5 9.9 21.2 9.5 C 22.9 9.15 24.2 10.1 25.6 11.3 C 27.2 12.7 28.2 14.4 30.3 17 C 26.2 16.3 22.4 15.7 19.4 16.4 Z"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      echo<span className="text-ink-faint">back</span>
    </span>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <Wordmark className="text-[1.05rem]" />
    </span>
  );
}
