"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { interestAction } from "@/app/actions";

export function InterestButton({
  matchId,
  revealed,
  interested,
  mutual,
}: {
  matchId: string;
  revealed: boolean;
  interested: boolean;
  mutual: boolean;
}) {
  const [state, setState] = useState<{ interested: boolean; mutual: boolean }>({
    interested,
    mutual,
  });
  const [pending, startTransition] = useTransition();

  if (!revealed) {
    return (
      <Link
        href="/pricing"
        className="shrink-0 rounded-full border border-hairline px-4 py-2 text-sm text-ink-faint transition hover:border-ink-faint hover:text-ink"
      >
        Locked
      </Link>
    );
  }

  if (state.mutual) {
    return (
      <Link
        href="/inbox"
        className="grad-audio shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Mutual — inbox
      </Link>
    );
  }

  if (state.interested) {
    return (
      <span className="shrink-0 cursor-default rounded-full border border-hairline px-4 py-2 text-sm text-ink-faint">
        Interest sent
      </span>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await interestAction(matchId);
          setState({ interested: true, mutual: Boolean(result?.mutual) });
        })
      }
      className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft disabled:opacity-60"
    >
      {pending ? "Sending…" : "Express interest"}
    </button>
  );
}
