"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/logo";

/*
  Last-resort boundary. Without it an unhandled error shows Next's grey
  default page, which reads as "the site is broken" rather than "something
  went wrong, here's the way back".
*/

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[unhandled]", error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <LogoMark size={40} />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">That didn&rsquo;t come back</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Something broke on our side. Nothing you did caused it, and nothing you
          uploaded is lost.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-hairline bg-paper-raised px-6 py-3 text-sm transition hover:border-ink-faint"
          >
            Back to EchoBack
          </Link>
        </div>
        {error.digest && (
          <p className="mt-8 font-mono text-xs text-ink-faint">
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
