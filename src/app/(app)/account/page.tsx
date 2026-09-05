import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getOwnProfile } from "@/lib/data";
import { cancelSubscriptionAction, signOutAction, updateProfileAction } from "@/app/actions";
import { ALL_GENRES, TIER_META } from "@/lib/types";
import { roleLabel } from "@/lib/demo/seed";
import { demoMode } from "@/lib/config";

export const metadata = { title: "Account" };

const inputCls =
  "rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-ink-faint/70 focus:border-ink-faint";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const [profile, { saved }] = await Promise.all([getOwnProfile(user), searchParams]);
  const sub = user.subscription;
  const isTalent = user.role !== "creator";

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <p className="label text-ink-faint">Account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{user.displayName}</h1>
      <p className="mt-1 text-sm text-ink-faint">
        {roleLabel(user.role)} · {user.email}
      </p>

      {saved && (
        <p className="mt-6 rounded-xl border border-hairline bg-paper-raised px-4 py-3 text-sm text-ink-soft">
          Profile saved.
        </p>
      )}

      {/* ---- profile ---- */}
      <section className="mt-10 rounded-2xl border border-hairline bg-paper-raised p-7">
        <div className="flex items-baseline justify-between gap-3">
          <p className="label text-ink-faint">Your profile</p>
          <Link href={`/profile/${user.id}`} className="text-xs underline underline-offset-4">
            View as others see it →
          </Link>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {isTalent
            ? "This is your shop window — it's what a creator reads before deciding to reach out."
            : "This is what an artist or producer sees when you ask to work with them."}
        </p>

        <form action={updateProfileAction} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="label text-ink-faint">Name</span>
            <input
              name="displayName"
              defaultValue={profile?.displayName ?? user.displayName}
              maxLength={60}
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="label text-ink-faint">Location</span>
            <input
              name="location"
              defaultValue={profile?.location ?? ""}
              maxLength={80}
              placeholder="e.g. London, UK"
              className={inputCls}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="label text-ink-faint">
              {user.role === "artist"
                ? "Your voice, in one line"
                : user.role === "producer"
                  ? "Your sound, in one line"
                  : "How you work, in one line"}
            </span>
            <input
              name="craft"
              defaultValue={profile?.craft ?? ""}
              maxLength={120}
              placeholder={
                user.role === "artist"
                  ? "e.g. Contralto — smoked, close-mic intimacy"
                  : user.role === "producer"
                    ? "e.g. Analogue-first: modular textures, tape saturation"
                    : "e.g. Writes with AI, finishes with people"
              }
              className={inputCls}
            />
          </label>

          <fieldset className="flex flex-col gap-3">
            <legend className="label text-ink-faint">Genres — pick up to six</legend>
            <div className="flex flex-wrap gap-1.5">
              {ALL_GENRES.map((g) => (
                <label key={g} className="cursor-pointer">
                  <input
                    type="checkbox"
                    name="genres"
                    value={g}
                    defaultChecked={profile?.genres.includes(g)}
                    className="peer sr-only"
                  />
                  <span className="block rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-soft transition hover:border-ink-faint peer-checked:border-transparent peer-checked:bg-ink peer-checked:text-paper">
                    {g}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className="label text-ink-faint">About you</span>
            <textarea
              name="bio"
              defaultValue={profile?.bio ?? ""}
              maxLength={600}
              rows={4}
              placeholder="A few lines about what you make and who you want to make it with."
              className={`${inputCls} resize-none`}
            />
          </label>

          <button className="mt-2 self-start rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft">
            Save profile
          </button>
        </form>
      </section>

      {/* ---- subscription ---- */}
      <section className="mt-6 rounded-2xl border border-hairline bg-paper-raised p-7">
        <p className="label text-ink-faint">Subscription</p>
        {sub ? (
          <>
            <div className="mt-4 flex items-baseline justify-between">
              <p className="text-xl font-semibold tracking-tight">{TIER_META[sub.tier].name}</p>
              <p className="font-mono text-sm text-ink-soft">
                {TIER_META[sub.tier].price}
                <span className="text-ink-faint">/mo</span>
              </p>
            </div>
            {sub.status === "active" ? (
              <>
                <p className="mt-2 text-sm text-ink-soft">
                  Active — renews{" "}
                  {new Date(sub.renewsAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                  })}
                  .
                </p>
                <form action={cancelSubscriptionAction} className="mt-6">
                  <button className="text-sm text-ink-faint underline underline-offset-4 transition hover:text-ink">
                    Cancel subscription
                  </button>
                </form>
                <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                  If you cancel: your uploads stay live and still match, matches
                  re-blur, and you can no longer reach out first — but every
                  conversation you already have stays open, and anyone can still
                  reach you.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-soft">
                  Lapsed — matches are re-blurred and you can&rsquo;t start new
                  conversations. Existing ones are still open.
                </p>
                <Link
                  href="/pricing"
                  className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-soft"
                >
                  Renew
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              No subscription. Uploading, matching and answering anyone who reaches
              out are all free — you only pay to make the first move.
            </p>
            <Link
              href="/pricing"
              className="grad-audio mt-5 inline-block rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              See plans
            </Link>
          </>
        )}
      </section>

      {demoMode && (
        <p className="mt-6 text-xs leading-relaxed text-ink-faint">
          Demo mode: this account lives in memory with a seeded library, so the whole
          loop can be felt without any configuration. Subscriptions here are
          simulated; with Stripe + Supabase configured this page reflects live
          billing state.
        </p>
      )}

      <form action={signOutAction} className="mt-10">
        <button className="rounded-full border border-hairline px-5 py-2.5 text-sm text-ink-soft transition hover:border-ink-faint hover:text-ink">
          Sign out
        </button>
      </form>
    </div>
  );
}
