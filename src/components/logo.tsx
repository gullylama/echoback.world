/*
  The EchoBack mark: an orca back breaking the surface — dorsal fin atop
  the outer wave — with the echo returning beneath it as nested arcs.
  Monochrome, always: the gradient stays reserved for audio itself.
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
      {/* body arc + fin, one filled form */}
      <path
        fill="currentColor"
        d="M6 31
           C 9.2 24.2, 14.6 19.8, 21.2 18.8
           C 21.6 14.6, 23.4 10.4, 27.8 7.4
           C 26.9 11.2, 27.6 14.6, 30.2 17.4
           C 35.4 19.6, 39.6 24.6, 42 31
           C 38 26, 31.8 23, 24 23
           C 16.2 23, 10 26, 6 31 Z"
      />
      {/* the returning echo */}
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M12.5 37.5 Q 24 30, 35.5 37.5" />
        <path d="M18 44 Q 24 39.6, 30 44" />
      </g>
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
