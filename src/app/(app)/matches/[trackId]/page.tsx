import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getMatchesForTrack, getTrack } from "@/lib/data";
import { TrackPlayer } from "@/components/track-player";
import { ComponentBars, SimilarityBadge } from "@/components/meters";
import { Avatar } from "@/components/avatar";
import { fmtDuration } from "@/lib/format";
import { tierCoversProducers, type MatchView } from "@/lib/types";
import { InterestButton } from "./interest-button";

export const metadata = { title: "Matches" };

export default async function MatchesPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/start");
  if (user.role !== "creator") redirect("/studio");

  const { trackId } = await params;
  const track = getTrack(user, trackId);
  if (!track) notFound();

  const matches = getMatchesForTrack(user, trackId);
  const artists = matches.filter((m) => m.talent.role === "artist");
  const producers = matches.filter((m) => m.talent.role === "producer");

  const subActive = user.subscription?.status === "active";
  const producersUnlocked = subActive && tierCoversProducers(user.subscription!.tier);

  return (
    <div className="animate-rise">
      <Link href="/studio" className="text-sm text-ink-faint transition hover:text-ink">
        ← Studio
      </Link>

      <header className="mt-6 flex flex-col gap-6 rounded-2xl border border-hairline bg-paper-raised p-6 sm:flex-row sm:items-center sm:gap-10">
        <div className="sm:w-72">
          <p className="label text-ink-faint">The echo you sent</p>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{track.title}</h1>
          <p className="mt-1 text-xs text-ink-faint">Demo · {fmtDuration(track.durationSec)}</p>
        </div>
        <TrackPlayer seed={track.seed} className="flex-1" />
        <div className="text-sm text-ink-soft sm:text-right">
          <p>
            <span className="font-mono text-xl font-medium grad-audio-text">{artists.length}</span>{" "}
            artists
          </p>
          <p>
            <span className="font-mono text-xl font-medium grad-audio-text">{producers.length}</span>{" "}
            producers
          </p>
        </div>
      </header>

      {!subActive && (
        <div className="sticky top-[4.5rem] z-30 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-hairline bg-night p-5 text-night-ink shadow-lg">
          <p className="text-sm leading-relaxed">
            <strong>
              {artists.length} artists{producers.length ? ` and ${producers.length} producers` : ""}
            </strong>{" "}
            match this demo. Subscribe to reveal who they are and make contact.
          </p>
          <Link
            href="/pricing"
            className="grad-audio rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Reveal matches — from £15.99/mo
          </Link>
        </div>
      )}

      <Section title="Artists" sub="Matched on voice and style — ranked by how strongly they echo.">
        {artists.map((m, i) => (
          <MatchCard key={m.id} match={m} rank={i + 1} />
        ))}
      </Section>

      <Section
        title="Producers"
        sub={
          producersUnlocked || !subActive
            ? "Matched on production and style — the sound, independent of the voice."
            : "Producers unlock on the Artists + Producers tier (£20/mo)."
        }
        action={
          subActive && !producersUnlocked ? (
            <Link href="/pricing" className="text-sm font-medium underline underline-offset-4">
              Upgrade →
            </Link>
          ) : null
        }
      >
        {producers.map((m, i) => (
          <MatchCard key={m.id} match={m} rank={i + 1} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  sub,
  action,
  children,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-ink-faint">{sub}</p>
        </div>
        {action}
      </div>
      <div className="mt-6 flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
        {children}
      </div>
    </section>
  );
}

function MatchCard({ match, rank }: { match: MatchView; rank: number }) {
  const t = match.talent;
  return (
    <article className="flex flex-col gap-5 bg-paper-raised p-6 lg:flex-row lg:items-center lg:gap-8">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="w-7 shrink-0 font-mono text-sm text-ink-faint">
          {String(rank).padStart(2, "0")}
        </span>
        <Avatar seed={t.avatarSeed} size={52} blurred={!match.revealed} />
        <div className="min-w-0">
          <p className={`truncate text-lg font-semibold tracking-tight ${match.revealed ? "" : "redacted"}`}>
            {t.displayName}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-faint">
            {t.role === "artist" ? "Artist" : "Producer"} · {t.genres.join(", ")}
            {t.location ? ` · ${t.location}` : ""}
          </p>
          <p className="mt-1 truncate text-sm text-ink-soft">{t.craft}</p>
        </div>
      </div>

      <div className="w-full lg:w-56">
        <ComponentBars
          vocal={match.scores.vocal}
          style={match.scores.style}
          production={match.scores.production}
          talentRole={t.role}
        />
      </div>

      <div className="flex items-center justify-between gap-6 lg:w-52 lg:justify-end">
        <SimilarityBadge score={match.scores.blended} size="lg" />
        <InterestButton
          matchId={match.id}
          revealed={match.revealed}
          interested={match.interested}
          mutual={match.mutual}
        />
      </div>
    </article>
  );
}
