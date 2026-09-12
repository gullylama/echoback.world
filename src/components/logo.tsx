/*
  The EchoBack mark.

  Traced directly from the supplied artwork with potrace rather than redrawn
  by hand, so the curves are the artwork's own. The source is 182x140, which
  normalises to a 13:10 viewBox — the mark is wider than it is tall, and
  squaring it is what made earlier versions look wrong.

  Monochrome by design: it inherits currentColor, and the lilac-to-rose
  gradient stays reserved for audio itself.

  `size` is the rendered height; the width follows from the aspect ratio.
*/

/** Intrinsic proportions of the artwork. */
export const MARK_VIEWBOX = { width: 52, height: 40 } as const;
export const MARK_RATIO = MARK_VIEWBOX.width / MARK_VIEWBOX.height;
export const MARK_PATH =
  "M36.43 40.02C36.16 39.9 35.88 39.64 35.57 39.2C30.18 31.65 22.31 31.48 16.82 38.79C15.68 40.31 14.93 40.25 13.35 38.53C12.15 37.22 12.22 36.96 14.57 34.26C19.26 28.89 26.41 27.31 32.42 30.33C34.86 31.55 37.45 33.92 39.18 36.5C39.85 37.5 39.82 37.98 39.06 38.65C38.88 38.8 38.55 39.1 38.32 39.32C37.58 40.01 36.95 40.24 36.43 40.02Z M43.08 33.09C42.64 33.02 42.41 32.83 41.36 31.62C40.66 30.82 39.41 29.56 38.57 28.81C37.07 27.47 34.27 25.74 32.6 25.12C26.24 22.77 20.22 23.68 14.57 27.87C13.45 28.7 11.96 30.17 10.29 32.09C9.3 33.22 8.64 33.28 7.41 32.35C5.7 31.06 5.6 30.37 6.91 28.88C8.43 27.16 9.26 26.33 10.96 24.83C12.36 23.59 14.98 21.92 16.65 21.19C16.88 21.09 17.42 20.86 17.84 20.68C22.15 18.8 27.64 18.56 32.49 20.04C33.37 20.31 33.89 20.52 35.17 21.08C35.5 21.23 36.7 21.86 37.33 22.22C39.75 23.6 42.12 25.59 44.14 27.93C44.39 28.22 44.78 28.66 45.0 28.91C46.55 30.6 46.63 31.02 45.55 31.91C44.37 32.88 43.73 33.19 43.08 33.09Z M49.26 26.1C48.95 25.95 48.6 25.61 47.59 24.48C45.82 22.47 43.45 20.37 41.5 19.06C39.3 17.59 37.04 16.46 34.83 15.75C32.25 14.91 30.01 14.47 27.65 14.33C26.66 14.27 24.02 14.3 23.33 14.38C15.69 15.24 9.79 18.53 4.04 25.11C2.81 26.51 2.02 26.57 0.84 25.33C-0.38 24.05 -0.37 23.78 1.01 21.85C2.13 20.3 2.17 20.25 3.75 18.41C4.3 17.77 6.46 15.68 7.24 15.03C11.09 11.8 15.08 9.62 19.46 8.33C20.91 7.91 21.75 7.16 22.13 5.96C22.38 5.17 22.2 4.54 21.5 3.76C20.32 2.45 20.11 1.98 20.29 1.12C20.59 -0.35 23.24 -0.43 25.98 0.93C28.56 2.23 30.53 3.94 32.02 6.19C33.04 7.73 33.12 7.79 35.24 8.73C35.8 8.98 36.47 9.26 36.71 9.35C41.94 11.3 46.76 15.43 50.77 21.41C52.19 23.52 52.26 23.94 51.37 25.06C50.51 26.14 49.94 26.43 49.26 26.1Z";

export function LogoMark({ size = 21, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={Math.round(size * MARK_RATIO * 100) / 100}
      height={size}
      viewBox={`0 0 ${MARK_VIEWBOX.width} ${MARK_VIEWBOX.height}`}
      fill="none"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path fill="currentColor" d={MARK_PATH} />
    </svg>
  );
}

/*
  "echo" in ink, "back" in purple: the hand-off the whole product is about,
  said in two syllables. Purple is the life returning.
*/
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      echo<span className="text-lilac-ink">back</span>
    </span>
  );
}

export function Logo({ size = 21 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} className="text-lilac-deep" />
      <Wordmark className="text-[1.05rem]" />
    </span>
  );
}
