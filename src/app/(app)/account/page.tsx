import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { cancelSubscriptionAction, signOutAction } from "@/app/actions";
import { TIER_META } from "@/lib/types";
import { roleLabel } from "@/lib/demo/seed";
import { demoMode } from "@/lib/config";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/start");
  const sub = user.subscription;

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <p className="label text-ink-faint">Account</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{user.displayName}</h1>
      <p className="mt-1 text-sm text-ink-faint">
        {roleLabel(user.role)} · {user.email}
      </p>

      <section className="mt-10 rounded-2xl border border-hairline bg-paper-raised p-7">
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
                  Active — renews {new Date(sub.renewsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
                </p>
                <form action={cancelSubscriptionAction} className="mt-6">
                  <button className="text-sm text-ink-faint underline underline-offset-4 transition hover:text-ink">
                    Cancel subscription
                  </button>
                </form>
                <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                  If you cancel: uploads stay live, matches re-blur, and your inbox
                  becomes read-only until you renew.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-soft">
                  Lapsed — matches are re-blurred and your inbox is read-only.
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
              No subscription. Uploading and matching stay free — subscribe when
              you&rsquo;re ready to reveal who&rsquo;s echoing back.
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
