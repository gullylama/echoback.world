import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getFeed } from "@/lib/data";
import { SwipeDeck } from "./swipe-deck";
import { Avatar } from "@/components/avatar";
import { EchoField } from "@/components/echo-field";

export const metadata = { title: "Feed" };

export default async function FeedPage() {
  const user = await currentUser();
  if (!user) redirect("/start");
  if (user.role === "creator") redirect("/studio");

  const items = await getFeed(user);
  const subActive = user.subscription?.status === "active";
  const noun = user.role === "artist" ? "voice" : "sound";

  if (!subActive) {
    return (
      <div className="mx-auto max-w-md animate-rise text-center">
        <p className="label text-ink-faint">Your feed</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          <span className="grad-audio-text">{items.length} tracks</span>
          <br />
          matched to your {noun}
        </h1>

        <div className="relative mx-auto mt-12 h-72 w-64">
          <EchoField className="absolute -inset-20 opacity-30" />
          {items.slice(0, 3).map((item, i) => (
            <div
              key={item.id}
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
                  {Math.round(item.scores.blended)}%
                </span>
              </div>
              <p className="redacted mt-4 text-xl font-semibold tracking-tight">{item.demo.title}</p>
              <p className="redacted mt-1 text-sm text-ink-faint">by {item.demo.creatorName}</p>
              <div className="mt-5 flex h-9 items-end gap-[3px] opacity-30">
                {Array.from({ length: 24 }).map((_, b) => (
                  <span
                    key={b}
                    className="w-[3px] rounded-full bg-ink"
                    style={{ height: `${20 + ((b * 37 + item.demo.seed) % 80)}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm leading-relaxed text-ink-soft">
          They&rsquo;re already here, ranked and waiting. Subscribe to hear them,
          swipe through them, and reply.
        </p>
        <Link
          href="/pricing"
          className="grad-audio mt-6 inline-block rounded-full px-7 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Unlock the feed — £15.99/mo
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <div className="text-center">
        <p className="label text-ink-faint">Your feed</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {items.length > 0 ? (
            <>
              {items.length} track{items.length > 1 ? "s" : ""} echo{items.length === 1 ? "es" : ""}{" "}
              your {noun}
            </>
          ) : (
            "All caught up"
          )}
        </h1>
      </div>
      {items.length > 0 ? (
        <SwipeDeck initialItems={items} />
      ) : (
        <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-dashed border-hairline p-10 text-center">
          <Avatar seed={7} size={44} />
          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            Nothing to triage right now. New tracks that match your {noun} will appear
            here the moment they&rsquo;re fingerprinted.
          </p>
        </div>
      )}
    </div>
  );
}
