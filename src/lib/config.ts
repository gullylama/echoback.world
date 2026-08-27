/* Environment-driven configuration. */

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const stripeConfigured = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET
);

/**
 * Demo mode: the full product loop runs against an in-memory store with
 * seeded talent, so the app is experiencable with zero configuration.
 */
export const demoMode = !supabaseConfigured;
