import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { countFeed, countMatchesForTrack, getThreads, getTracks } from "@/lib/data";
import { TrackPlayer } from "@/components/track-player";
import { EchoPulse } from "@/components/meters";
import { fmtDuration, timeAgo } from "@/lib/format";

export const metadata = { title: "Studio" };

export default async function StudioPage() {
  const user = await currentUser();
  if (!user) redirect("/start");
  return user.role === "creator" ? <CreatorStudio /> : <TalentStudio />;
}

/* ------------------------------------------------------------- creator */

async function CreatorStudio() {
  const user = (await currentUser())!;
  const demos = getTracks(user).filter((t) => t.kind === "demo");
  const threads = getThreads(user);
  const subActive = user.subscription?.status === "active";

  return (
    <div className="animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-ink-faint">Studio</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {demos.length === 0 ? `Welcome, ${user.displayName}` : `Your demos`}
          </h1>
        </div>
        <Link
          href="/upload"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-soft"
        >
          Upload a demo
        </Link>
      </header>

      {user.subscription?.status === "lapsed" && <LapsedBanner />}

      {demos.length === 0 ? (
        <div className="mt-14 flex flex-col items-center rounded-2xl border border-dashed border-hairline py-20 text-center">
          <EchoPulse size={64} />
          <h2 className="mt-8 text-xl font-semibold tracking-tight">Send your first echo</h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
            Upload a demo and the engine will return the real artists and producers
            whose sound it already resembles.
          </p>
          <Link
            href="/upload"
            className="mt-8 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
          >
            Upload a demo — free
          </Link>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
          {demos.map((demo) => {
            const counts = countMatchesForTrack(demo.id);
            return (
              <div key={demo.id} className="flex flex-col gap-5 bg-paper-raised p-6 sm:flex-row sm:items-center sm:gap-8">
                <div className="min-w-0 sm:w-64">
                  <p className="truncate text-lg font-semibold tracking-tight">{demo.title}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {fmtDuration(demo.durationSec)} · uploaded {timeAgo(demo.createdAt)}
                  </p>
                </div>
                <TrackPlayer seed={demo.seed} className="flex-1" height={34} />
                <div className="flex items-center gap-6 sm:w-72 sm:justify-end">
                  <p className="text-sm text-ink-soft">
                    <span className="font-mono font-medium grad-audio-text">{counts.artists}</span> artists
                    {" · "}
                    <span className="font-mono font-medium grad-audio-text">{counts.producers}</span> producers
                  </p>
                  <Link
                    href={`/matches/${demo.id}`}
                    className="shrink-0 rounded-full border border-hairline px-4 py-2 text-sm font-medium transition hover:border-ink-faint"
                  >
                    {subActive ? "View matches" : "See who"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {threads.length > 0 && (
        <p className="mt-8 text-sm text-ink-soft">
          {threads.length} conversation{threads.length > 1 ? "s" : ""} open in your{" "}
          <Link href="/inbox" className="font-medium underline underline-offset-4">
            inbox
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- talent */

async function TalentStudio() {
  const user = (await currentUser())!;
  const refs = getTracks(user).filter((t) => t.kind !== "demo");
  const feedCount = countFeed(user);
  const threads = getThreads(user);
  const subActive = user.subscription?.status === "active";
  const noun = user.role === "artist" ? "voice" : "sound";

  return (
    <div className="animate-rise">
      <p className="label text-ink-faint">Studio</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {feedCount > 0 ? (
          <>
            <span className="grad-audio-text">{feedCount} demos</span> matched to your {noun}
          </>
        ) : (
          `Welcome, ${user.displayName}`
        )}
      </h1>

      {user.subscription?.status === "lapsed" && <LapsedBanner />}

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-hairline bg-paper-raised p-7">
          {subActive ? (
            <>
              <p className="text-sm leading-relaxed text-ink-soft">
                Your feed is open. Every demo below echoed your {noun} — swipe through
                and keep only what moves you.
              </p>
              <Link
                href="/feed"
                className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
              >
                Open the feed{feedCount ? ` (${feedCount})` : ""}
              </Link>
            </>
          ) : (
            <>
              <p className="label text-ink-faint">Waiting for you</p>
              <p className="mt-3 text-lg leading-relaxed">
                {feedCount > 0 ? (
                  <>
                    <strong>{feedCount} demos</strong> have been matched to your {noun}.
                    Subscribe to open the feed, hear them, and reply.
                  </>
                ) : (
                  <>Demos matched to your {noun} will accumulate here.</>
                )}
              </p>
              <Link
                href="/pricing"
                className="grad-audio mt-6 inline-block rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Subscribe to unlock — £15.99/mo
              </Link>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-hairline bg-paper-raised p-7">
          <div className="flex items-center justify-between">
            <p className="label text-ink-faint">Your reference library</p>
            <Link href="/upload" className="text-sm font-medium underline underline-offset-4">
              Add
            </Link>
          </div>
          {refs.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Upload your {noun} to seed the library — matching starts the moment the
              engine has something to listen to.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {refs.map((t) => (
                <li key={t.id}>
                  <p className="text-sm font-medium">{t.title}</p>
                  <TrackPlayer seed={t.seed} height={26} barCount={44} className="mt-2" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {threads.length > 0 && (
        <p className="mt-8 text-sm text-ink-soft">
          {threads.length} conversation{threads.length > 1 ? "s" : ""} open in your{" "}
          <Link href="/inbox" className="font-medium underline underline-offset-4">
            inbox
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function LapsedBanner() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-paper-raised p-5">
      <p className="text-sm leading-relaxed text-ink-soft">
        Your subscription has lapsed — matches have re-blurred and your inbox is
        read-only. Your uploads are still live and still matching.
      </p>
      <Link
        href="/pricing"
        className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper transition hover:bg-ink-soft"
      >
        Renew
      </Link>
    </div>
  );
}
