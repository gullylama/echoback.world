-- Track the Stripe billing period so "renews on" is accurate.
alter table subscriptions
  add column if not exists current_period_end timestamptz;
