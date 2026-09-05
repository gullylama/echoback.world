-- Requests — "payment buys the right to make the first move."
--
-- Replaces blind mutual interest. A subscriber sends a request on a match;
-- the recipient reads it, hears the track and accepts or declines FOR FREE.
-- Accepting opens the thread. This guarantees a paying user always reaches
-- a real, reachable human.

create type request_state as enum ('pending', 'accepted', 'declined');

create table requests (
  id uuid primary key default gen_random_uuid(),
  -- one request per pairing: prevents repeat pestering
  match_id uuid not null unique references matches (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  recipient_id uuid not null references profiles (id) on delete cascade,
  state request_state not null default 'pending',
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index requests_recipient_idx on requests (recipient_id, state, created_at desc);
create index requests_sender_idx on requests (sender_id, created_at desc);

alter table requests enable row level security;
create policy "own requests" on requests for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
