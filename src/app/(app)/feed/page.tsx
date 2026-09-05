import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { countPendingRequests, feedGenres, getFeed } from "@/lib/data";
import { TrackPlayer } from "@/components/track-player";
import { RequestButton } from "@/components/request-button";
import { SimilarityBadge } from "@/components/meters";
import { EchoField } from "@/components/echo-field";
import { fmtDuration, timeAgo } from "@/lib/format";
import type { FeedItemView, FeedQuery } from "@/lib/types";
import { FeedControls } from "./feed-controls";
import { SwipeDeck } from "./swipe-deck";

export const metadata = { title: "Feed" };

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; sort?: string; genre?: string; q?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/start");
  if (user.role === "creator") redirect("/studio");

  const sp = await searchParams;
  const query: FeedQuery = {
    sort: sp.sort === "newest" ? "newest" : "match",
    genre: sp.genre,
    q: sp.q,
  };
  const [items, genres, pending] = await Promise.all([
    getFeed(user, query),
    feedGenres(user),
    countPendingRequests(user),
  ]);
  const subActive = user.subscription?.status === "active";
  const noun = user.role === "artist" ? "voice" : "sound";

  if (!subActive) return <LockedFeed count={items.length} noun={noun} pending={pending} />;

  const view = sp.view === "swipe" ? "swipe" : "list";

  return (
    <div className="animate-rise">
      <header>
        <p className="label text-ink-faint">Your feed</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {items.length > 0 ? (
            <>
              {items.length} track{items.length > 1 ? "s" : ""} matched to your {noun}
            </>
          ) : (
            "Nothing left to triage"
          )}
        </h1>
      </header>

      <div className="mt-6">
        <FeedControls genres={genres} view={view} />
      </div>

      {items.length === 0 ? (
        <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-dashed border-hairline p-10 text-center">
          <p className="text-sm leading-relaxed text-ink-soft">
            Nothing here right now. New AI tracks that match your {noun} appear the
            moment they&rsquo;re fingerprinted.
          </p>
        </div>
      ) : view === "swipe" ? (
        <SwipeDeck initialItems={items} />
      ) : (
        <div className="mt-6 flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
          {items.map((item) => (
            <FeedRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedRow({ item }: { item: FeedItemView }) {
  const component = item.scores.vocal || item.scores.production;
  return (
    <article className="flex flex-col gap-4 bg-paper-raised p-5 lg:flex-row lg:items-center lg:gap-6">
      <div className="min-w-0 lg:w-64">
        <p className="truncate text-base font-semibold tracking-tight">{item.demo.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-faint">
          by {item.demo.creatorName}
          {item.demo.genres.length > 0 && <> · {item.demo.genres.join(", ")}</>}
          {item.demo.durationSec > 0 && <> · {fmtDuration(item.demo.durationSec)}</>}
        </p>
        <p className="mt-0.5 text-xs text-ink-faint">{timeAgo(item.createdAt)}</p>
      </div>

      <TrackPlayer seed={item.demo.seed} className="min-w-0 flex-1" height={30} barCount={48} />

      <div className="flex flex-wrap items-center justify-between gap-4 lg:w-64 lg:justify-end">
        <div className="flex items-baseline gap-3">
          <SimilarityBadge score={item.scores.blended} />
          <span className="font-mono text-xs text-ink-faint">
            {Math.round(component)} / {Math.round(item.scores.style)}
          </span>
        </div>
        <RequestButton
          matchId={item.id}
          revealed
          request={item.request}
          counterpartyLabel={item.demo.creatorName}
        />
      </div>
    </article>
  );
}

/* ---- locked ------------------------------------------------------------ */

function LockedFeed({
  count,
  noun,
  pending,
}: {
  count: number;
  noun: string;
  pending: number;
}) {
  return (
    <div className="mx-auto max-w-md animate-rise text-center">
      <p className="label text-ink-faint">Your feed</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        <span className="grad-audio-text">{count} tracks</span>
        <br />
        matched to your {noun}
      </h1>

      <div className="relative mx-auto mt-12 h-64 w-64">
        <EchoField className="absolute -inset-20 opacity-30" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-x-0 mx-auto w-64 rounded-2xl border border-hairline bg-paper-raised p-6 shadow-sm"
            style={{
              top: i * 14,
              transform: `rotate(${(i - 1) * 3}deg) scale(${1 - i * 0.04})`,
              zIndex: 3 - i,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="label text-ink-faint">Matched track</span>
              <span className="font-mono text-lg font-medium grad-audio-text">
                {95 - i * 4}%
              </span>
            </div>
            <p className="redacted mt-4 text-xl font-semibold tracking-tight">Hidden title</p>
            <p className="redacted mt-1 text-sm text-ink-faint">by a creator</p>
            <div className="mt-5 flex h-9 items-end gap-[3px] opacity-30">
              {Array.from({ length: 24 }).map((_, b) => (
                <span
                  key={b}
                  className="w-[3px] rounded-full bg-ink"
                  style={{ height: `${20 + ((b * 37 + i * 11) % 80)}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm leading-relaxed text-ink-soft">
        Subscribing lets you search all of them, hear them, and reach out first —
        rather than waiting to be found.
      </p>
      <Link
        href="/pricing"
        className="grad-audio mt-6 inline-block rounded-full px-7 py-3 text-sm font-semibold text-white transition hover:opacity-90"
      >
        Unlock the feed — £16/mo
      </Link>

      <p className="mt-8 border-t border-hairline pt-6 text-sm leading-relaxed text-ink-soft">
        {pending > 0 ? (
          <>
            <strong className="text-ink">
              {pending} creator{pending > 1 ? "s have" : " has"} already asked to work
              with you.
            </strong>{" "}
            Reading and answering them is free —{" "}
            <Link href="/inbox" className="font-medium underline underline-offset-4">
              open your inbox
            </Link>
            .
          </>
        ) : (
          <>
            Anyone who asks to work with you reaches you for free — you never need a
            subscription to answer.
          </>
        )}
      </p>
    </div>
  );
}
