import Stripe from "stripe";
import type { Tier } from "@/lib/types";

/*
  Stripe billing — four monthly prices (doc 07):
    creator_artists £15.99 · creator_full £20 · artist £15.99 · producer £15.99
  Create the prices in the Stripe dashboard and set their ids in env.
*/

export function stripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

const PRICE_ENV: Record<Tier, string> = {
  creator_artists: "STRIPE_PRICE_CREATOR_ARTISTS",
  creator_full: "STRIPE_PRICE_CREATOR_FULL",
  artist: "STRIPE_PRICE_ARTIST",
  producer: "STRIPE_PRICE_PRODUCER",
};

export function priceIdFor(tier: Tier): string {
  const id = process.env[PRICE_ENV[tier]];
  if (!id) throw new Error(`Missing env ${PRICE_ENV[tier]}`);
  return id;
}

export function tierForPriceId(priceId: string): Tier | null {
  for (const tier of Object.keys(PRICE_ENV) as Tier[]) {
    if (process.env[PRICE_ENV[tier]] === priceId) return tier;
  }
  return null;
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echoback.world";

export async function createCheckoutSession(
  userId: string,
  email: string,
  tier: Tier
): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    client_reference_id: userId,
    line_items: [{ price: priceIdFor(tier), quantity: 1 }],
    subscription_data: { metadata: { userId, tier } },
    success_url: `${SITE}/studio?subscribed=1`,
    cancel_url: `${SITE}/pricing`,
  });
  return session.url!;
}
