/*
  The mark encodes the product: two mirrored waves meeting — AI sound
  meeting human sound — and three waves below: the echo returning.
*/

export function LogoMark({ size = 28, id = "lg" }: { size?: number; id?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-lilac-deep)" />
          <stop offset="0.5" stopColor="var(--color-lilac)" />
          <stop offset="1" stopColor="var(--color-rose-deep)" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${id}-g)`} strokeWidth="3.4" strokeLinecap="round" fill="none">
        <path d="M4 17 C 11 5.5, 19 5.5, 24 17" />
        <path d="M24 17 C 29 28.5, 37 28.5, 44 17" />
        <path d="M13.5 29 Q 24 36, 34.5 29" opacity="0.85" />
        <path d="M17.5 36 Q 24 40.5, 30.5 36" opacity="0.6" />
        <path d="M21 42.5 Q 24 44.5, 27 42.5" opacity="0.38" />
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
      <LogoMark size={size} id={`lgo-${size}`} />
      <Wordmark className="text-[1.05rem]" />
    </span>
  );
}
