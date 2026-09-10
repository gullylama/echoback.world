-- Let people turn off notification email.
-- These are transactional (someone asked to work with you, someone replied),
-- but silence should still be one click away.

alter table profiles
  add column if not exists email_notifications boolean not null default true;
