import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeConfigured, supabaseConfigured } from "@/lib/config";
import { stripe, tierForPriceId } from "@/lib/stripe";

/*
  Stripe webhook → subscription status.
  Subscribe to: checkout.session.completed, customer.subscription.updated,
  customer.subscription.deleted, invoice.payment_failed.
*/

export async function POST(req: Request) {
  if (!stripeConfigured) {
    return NextResponse.json({ error: "billing not configured" }, { status: 501 });
  }

  const sig = req.headers.get("stripe-signature");
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      const item = sub.items.data[0];
      const tier = item?.price?.id ? tierForPriceId(item.price.id) : null;
      if (userId && tier) {
        const active = sub.status === "active" || sub.status === "trialing";
        const periodEnd = item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null;
        await upsertSubscription(userId, tier, active ? "active" : "lapsed", sub.id, {
          customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
          periodEnd,
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function upsertSubscription(
  userId: string,
  tier: string,
  status: "active" | "lapsed",
  stripeSubscriptionId: string,
  extra: { customerId?: string; periodEnd: string | null }
) {
  if (!supabaseConfigured) return;
  const { serviceClient } = await import("@/lib/supabase/service");
  await serviceClient()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        tier,
        status,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: extra.customerId ?? null,
        current_period_end: extra.periodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
}
