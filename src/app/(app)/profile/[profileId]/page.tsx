import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getProfile } from "@/lib/data";
import { Avatar } from "@/components/avatar";
import { TrackPlayer } from "@/components/track-player";
import { roleLabel } from "@/lib/demo/seed";

export const metadata = { title: "Profile" };

/**
 * Profiles are visible to people you're actually connected to: yourself,
 * anyone you share a request or conversation with, and — once subscribed —
 * your matches. Everyone else gets a 404.
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const { profileId } = await params;
  const profile = await getProfile(user, profileId);
  if (!profile) notFound();

  const isSelf = profile.id === user.id;
  const isTalent = profile.role !== "creator";

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <Link href="/studio" className="text-sm text-ink-faint transition hover:text-ink">
        ← Studio
      </Link>

      <header className="mt-6 flex flex-wrap items-center gap-6">
        <Avatar seed={profile.avatarSeed} size={84} />
        <div className="min-w-0">
          <p className="label text-ink-faint">{roleLabel(profile.role)}</p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight">{profile.displayName}</h1>
          {profile.location && (
            <p className="mt-1 text-sm text-ink-faint">{profile.location}</p>
          )}
        </div>
        {isSelf && (
          <Link
            href="/account"
            className="ml-auto rounded-full border border-hairline px-4 py-2 text-sm transition hover:border-ink-faint"
          >
            Edit
          </Link>
        )}
      </header>

      {profile.craft && (
        <p className="font-serif-display mt-8 text-xl leading-snug text-ink-soft">
          {profile.craft}
        </p>
      )}

      {profile.genres.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {profile.genres.map((g) => (
            <span
              key={g}
              className="rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-soft"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {profile.bio && (
        <p className="mt-8 max-w-lg text-[0.95rem] leading-relaxed text-ink-soft">{profile.bio}</p>
      )}

      {isTalent && (
        <section className="mt-10 rounded-2xl border border-hairline bg-paper-raised p-7">
          <p className="label text-ink-faint">
            {profile.role === "artist" ? "Their voice" : "Their sound"}
          </p>
          {profile.previewSeed !== null ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {profile.referenceCount} reference upload
                {profile.referenceCount === 1 ? "" : "s"} seeding the library — this is
                what tracks get matched against.
              </p>
              <TrackPlayer seed={profile.previewSeed} className="mt-4" height={40} />
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {isSelf
                ? "You haven't uploaded a reference yet — until you do, nothing can be matched to you."
                : "No reference uploaded yet."}
            </p>
          )}
        </section>
      )}

      {isSelf && profile.role === "creator" && (
        <p className="mt-10 text-sm leading-relaxed text-ink-faint">
          Artists and producers see this when you ask to work with them. A filled-in
          profile gets far more yeses than an empty one.
        </p>
      )}
    </div>
  );
}
