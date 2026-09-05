"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendRequestAction } from "@/app/actions";
import type { RequestSummary } from "@/lib/types";

/**
 * Sending is the paid act; answering is free. A request carries an optional
 * note, which is the single biggest factor in whether it gets accepted.
 */
export function RequestButton({
  matchId,
  revealed,
  request,
  counterpartyLabel,
}: {
  matchId: string;
  revealed: boolean;
  request: RequestSummary | null;
  counterpartyLabel: string;
}) {
  const [state, setState] = useState<RequestSummary | null>(request);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
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

  if (state?.state === "accepted") {
    return (
      <Link
        href={state.threadId ? `/inbox/${state.threadId}` : "/inbox"}
        className="grad-audio shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Open conversation
      </Link>
    );
  }

  if (state?.state === "declined") {
    return (
      <span className="shrink-0 cursor-default rounded-full border border-hairline px-4 py-2 text-sm text-ink-faint">
        {state.mine ? "Passed on it" : "You passed"}
      </span>
    );
  }

  if (state?.state === "pending") {
    return (
      <span className="shrink-0 cursor-default rounded-full border border-hairline px-4 py-2 text-sm text-ink-faint">
        {state.mine ? "Request sent" : "Waiting on you"}
      </span>
    );
  }

  const send = () =>
    startTransition(async () => {
      const result = await sendRequestAction(matchId, note);
      setOpen(false);
      if (result?.ok) {
        setState({
          id: "",
          state: (result.state as RequestSummary["state"]) ?? "pending",
          mine: true,
          threadId: result.threadId ?? null,
        });
      }
    });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
      >
        Request
      </button>
    );
  }

  return (
    <div className="w-full min-w-[15rem] rounded-xl border border-hairline bg-paper p-3">
      <label className="label block text-ink-faint">Note to {counterpartyLabel}</label>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Why this track, why them…"
        className="mt-2 w-full resize-none rounded-lg border border-hairline bg-paper-raised px-3 py-2 text-sm outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 text-xs text-ink-faint transition hover:text-ink"
        >
          Cancel
        </button>
        <button
          onClick={send}
          disabled={pending}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper transition hover:bg-ink-soft disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send request"}
        </button>
      </div>
    </div>
  );
}
