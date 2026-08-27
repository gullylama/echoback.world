import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { subscribeAction } from "@/app/actions";
import { currentUser } from "@/lib/session";
import { TIER_META, tierCoversRole, type Tier } from "@/lib/types";

export const metadata = { title: "Pricing" };

const DETAILS: Record<Tier, string[]> = {
  creator_artists: [
    "Unlimited demo uploads",
    "Full ranked match lists, revealed",
    "Express interest & message artists",
    "Producer matches stay counted, not revealed",
  ],
  creator_full: [
    "Everything in Creator — Artists",
    "Producer matches revealed & contactable",
    "One demo, two kinds of collaborator",
  ],
  artist: [
    "Voice reference uploads",
    "Swipe feed of demos matched to your voice",
    "Inbox on mutual interest",
    "Keep 100% of anything you make",
  ],
  producer: [
    "Production reel uploads",
    "Swipe feed matched on sound, not vocals",
    "Inbox on mutual interest",
    "Keep 100% of anything you make",
  ],
};

export default async function PricingPage() {
  const user = await currentUser();

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <p className="label text-ink-faint">Pricing</p>
        <h1 className="font-serif-display mt-4 max-w-lg text-3xl sm:text-5xl">
          Free to upload.
          <br />
          Pay to reveal the echo.
        </h1>
        <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
          Matches are always computed and always counted. Subscribing reveals who they
          are and opens the door to contact. Cancel any time — your uploads stay live,
          matches re-blur, and your inbox becomes read-only until you return.
        </p>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(TIER_META) as Tier[]).map((tier) => {
            const meta = TIER_META[tier];
            const current = user?.subscription?.status === "active" && user.subscription.tier === tier;
            const eligible = !user || tierCoversRole(tier, user.role);
            return (
              <div key={tier} className="flex flex-col bg-paper-raised p-7">
                <p className="label text-ink-faint">{meta.name}</p>
                <p className="mt-5 text-4xl font-semibold tracking-tight">
                  {meta.price}
                  <span className="text-sm font-normal text-ink-faint">/mo</span>
                </p>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm leading-relaxed text-ink-soft">
                  {DETAILS[tier].map((d) => (
                    <li key={d} className="flex gap-2.5">
                      <span className="grad-audio mt-[0.55rem] block h-[3px] w-3 shrink-0 rounded-full" />
                      {d}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  {current ? (
                    <span className="block rounded-full border border-hairline px-5 py-2.5 text-center text-sm text-ink-faint">
                      Your current plan
                    </span>
                  ) : user && eligible ? (
                    <form action={subscribeAction.bind(null, tier)}>
                      <button className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-ink-soft">
                        Subscribe
                      </button>
                    </form>
                  ) : user ? (
                    <span className="block cursor-default rounded-full border border-hairline px-5 py-2.5 text-center text-sm text-ink-faint">
                      For {meta.audience}s
                    </span>
                  ) : (
                    <Link
                      href={`/start?role=${meta.audience}`}
                      className="block rounded-full bg-ink px-5 py-2.5 text-center text-sm font-medium text-paper transition hover:bg-ink-soft"
                    >
                      Get started
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 max-w-lg text-sm leading-relaxed text-ink-faint">
          EchoBack takes no cut of anything made from a match. What you create together
          — and whatever it earns — is entirely yours.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
