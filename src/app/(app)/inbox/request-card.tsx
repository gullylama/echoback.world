"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { respondRequestAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { TrackPlayer } from "@/components/track-player";
import { SimilarityBadge } from "@/components/meters";
import { fmtDuration, timeAgo } from "@/lib/format";
import { roleLabel } from "@/lib/demo/seed";
import type { RequestView } from "@/lib/types";

/**
 * Answering is always free — you can hear the track, read the note and
 * decide without a subscription.
 */
export function RequestCard({ request }: { request: RequestView }) {
  const router = useRouter();
  const [state, setState] = useState(request.state);
  const [pending, startTransition] = useTransition();

  const respond = (accept: boolean) =>
    startTransition(async () => {
      const { threadId } = await respondRequestAction(request.id, accept);
      setState(accept ? "accepted" : "declined");
      if (accept && threadId) router.push(`/inbox/${threadId}`);
      else router.refresh();
    });

  const c = request.counterparty;

  return (
    <article className="bg-paper-raised p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar seed={c.avatarSeed} size={46} />
          <div className="min-w-0">
            <Link
              href={`/profile/${c.profileId}`}
              className="truncate font-semibold tracking-tight underline-offset-4 hover:underline"
            >
              {c.displayName}
            </Link>
            <p className="truncate text-xs text-ink-faint">
              {roleLabel(c.role)}
              {c.location ? ` · ${c.location}` : ""} · {timeAgo(request.sentAt)}
            </p>
            {c.craft && <p className="mt-0.5 truncate text-xs text-ink-soft">{c.craft}</p>}
          </div>
        </div>
        <SimilarityBadge score={request.scores.blended} />
      </div>

      {request.note && (
        <p className="mt-4 border-l-2 border-hairline pl-4 text-sm leading-relaxed text-ink-soft">
          &ldquo;{request.note}&rdquo;
        </p>
      )}

      <div className="mt-4 rounded-xl border border-hairline bg-paper p-4">
        <p className="truncate text-sm font-medium">{request.track.title}</p>
        {request.track.durationSec > 0 && (
          <p className="text-xs text-ink-faint">{fmtDuration(request.track.durationSec)}</p>
        )}
        <TrackPlayer seed={request.track.seed} className="mt-2" height={30} barCount={48} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {state === "pending" && request.incoming ? (
          <>
            <p className="text-xs text-ink-faint">Free to answer — no subscription needed.</p>
            <div className="flex gap-2">
              <button
                onClick={() => respond(false)}
                disabled={pending}
                className="rounded-full border border-hairline px-4 py-2 text-sm text-ink-soft transition hover:border-ink-faint hover:text-ink disabled:opacity-60"
              >
                Pass
              </button>
              <button
                onClick={() => respond(true)}
                disabled={pending}
                className="grad-audio rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "…" : "Accept"}
              </button>
            </div>
          </>
        ) : state === "pending" ? (
          <p className="text-sm text-ink-faint">Sent — waiting for their answer.</p>
        ) : state === "accepted" ? (
          <Link
            href={request.threadId ? `/inbox/${request.threadId}` : "/inbox"}
            className="text-sm font-medium underline underline-offset-4"
          >
            Open conversation →
          </Link>
        ) : (
          <p className="text-sm text-ink-faint">
            {request.incoming ? "You passed on this." : "They passed on this one."}
          </p>
        )}
      </div>
    </article>
  );
}
