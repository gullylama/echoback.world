-- EchoBack — initial schema
-- Postgres + pgvector on Supabase.
-- Embedding dimension: 512 (CLAP-family). Change VECTOR_DIM consistently
-- with the worker if you swap the embedding model.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- profiles — one per auth user
-- ---------------------------------------------------------------------------
create type user_role as enum ('creator', 'artist', 'producer');
create type track_kind as enum ('demo', 'voice', 'production');
create type track_status as enum ('uploaded', 'processing', 'fingerprinted', 'failed');
create type sub_tier as enum ('creator_artists', 'creator_full', 'artist', 'producer');
create type sub_status as enum ('active', 'lapsed');
create type interest_state as enum ('interested', 'passed');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null,
  display_name text not null,
  location text not null default '',
  bio text not null default '',
  genres text[] not null default '{}',
  craft text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tracks — uploads on all sides (demo / voice / production reference)
-- ---------------------------------------------------------------------------
create table tracks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  kind track_kind not null,
  title text not null,
  storage_path text not null,
  preview_path text,                  -- short watermarkable preview clip
  duration_sec int,
  content_hash text,                  -- idempotent fingerprinting / dedupe
  status track_status not null default 'uploaded',
  -- rights & consent (GDPR + upload terms; stored per upload)
  consent_confirmed boolean not null default false,
  rights_confirmed boolean not null default false,
  -- reference-library source flag: 'user' now, 'reference' in Phase 2.
  source text not null default 'user' check (source in ('user', 'reference')),
  created_at timestamptz not null default now()
);
create index tracks_owner_idx on tracks (owner_id);
create index tracks_kind_idx on tracks (kind, status);
create unique index tracks_owner_hash_uniq on tracks (owner_id, content_hash)
  where content_hash is not null;

-- ---------------------------------------------------------------------------
-- fingerprints — three component vectors per track
-- ---------------------------------------------------------------------------
create table fingerprints (
  track_id uuid primary key references tracks (id) on delete cascade,
  content_hash text,
  vocal_vector vector(512),
  style_vector vector(512),
  production_vector vector(512),
  created_at timestamptz not null default now()
);
create index fingerprints_vocal_idx on fingerprints
  using hnsw (vocal_vector vector_cosine_ops);
create index fingerprints_style_idx on fingerprints
  using hnsw (style_vector vector_cosine_ops);
create index fingerprints_production_idx on fingerprints
  using hnsw (production_vector vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- matches — cached nearest-neighbour results (recomputed on new uploads,
-- not on every view)
-- ---------------------------------------------------------------------------
create table matches (
  id uuid primary key default gen_random_uuid(),
  demo_track_id uuid not null references tracks (id) on delete cascade,
  talent_profile_id uuid not null references profiles (id) on delete cascade,
  talent_track_id uuid not null references tracks (id) on delete cascade,
  vocal_score real not null default 0,
  style_score real not null default 0,
  production_score real not null default 0,
  blended_score real not null,
  created_at timestamptz not null default now(),
  unique (demo_track_id, talent_profile_id)
);
create index matches_demo_idx on matches (demo_track_id, blended_score desc);
create index matches_talent_idx on matches (talent_profile_id, blended_score desc);

-- ---------------------------------------------------------------------------
-- interests / threads / messages — inbox opens on mutual interest only
-- ---------------------------------------------------------------------------
create table interests (
  match_id uuid not null references matches (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  state interest_state not null,
  created_at timestamptz not null default now(),
  primary key (match_id, profile_id)
);

create table threads (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches (id) on delete cascade,
  creator_id uuid not null references profiles (id) on delete cascade,
  talent_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  sent_at timestamptz not null default now()
);
create index messages_thread_idx on messages (thread_id, sent_at);

create table thread_reads (
  thread_id uuid not null references threads (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- subscriptions — driven by Stripe webhooks
-- ---------------------------------------------------------------------------
create table subscriptions (
  user_id uuid primary key references profiles (id) on delete cascade,
  tier sub_tier not null,
  status sub_status not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- match refresh — called by the fingerprint worker callback after vectors
-- land. Handles both directions:
--   demo track   → match against all talent reference tracks
--   talent track → match all existing demos against it
-- Cosine distance → similarity in [0,100].
-- ---------------------------------------------------------------------------
create or replace function refresh_matches_for_track(p_track_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_kind track_kind;
begin
  select kind into v_kind from tracks where id = p_track_id;

  if v_kind = 'demo' then
    insert into matches (demo_track_id, talent_profile_id, talent_track_id,
                         vocal_score, style_score, production_score, blended_score)
    select
      p_track_id,
      t.owner_id,
      t.id,
      case when t.kind = 'voice'
           then greatest(0, (1 - (df.vocal_vector <=> f.vocal_vector)) * 100) else 0 end,
      greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100),
      case when t.kind = 'production'
           then greatest(0, (1 - (df.production_vector <=> f.production_vector)) * 100) else 0 end,
      case when t.kind = 'voice'
           then greatest(0, (1 - (df.vocal_vector <=> f.vocal_vector)) * 100) * 0.55
                + greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100) * 0.45
           else greatest(0, (1 - (df.production_vector <=> f.production_vector)) * 100) * 0.6
                + greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100) * 0.4 end
    from tracks t
    join fingerprints f on f.track_id = t.id
    cross join (select * from fingerprints where track_id = p_track_id) df
    where t.kind in ('voice', 'production')
      and t.status = 'fingerprinted'
    on conflict (demo_track_id, talent_profile_id) do update
      set vocal_score = excluded.vocal_score,
          style_score = excluded.style_score,
          production_score = excluded.production_score,
          blended_score = excluded.blended_score,
          talent_track_id = excluded.talent_track_id;
  else
    insert into matches (demo_track_id, talent_profile_id, talent_track_id,
                         vocal_score, style_score, production_score, blended_score)
    select
      d.id,
      t.owner_id,
      p_track_id,
      case when v_kind = 'voice'
           then greatest(0, (1 - (df.vocal_vector <=> f.vocal_vector)) * 100) else 0 end,
      greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100),
      case when v_kind = 'production'
           then greatest(0, (1 - (df.production_vector <=> f.production_vector)) * 100) else 0 end,
      case when v_kind = 'voice'
           then greatest(0, (1 - (df.vocal_vector <=> f.vocal_vector)) * 100) * 0.55
                + greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100) * 0.45
           else greatest(0, (1 - (df.production_vector <=> f.production_vector)) * 100) * 0.6
                + greatest(0, (1 - (df.style_vector <=> f.style_vector)) * 100) * 0.4 end
    from tracks d
    join fingerprints df on df.track_id = d.id
    join tracks t on t.id = p_track_id
    join fingerprints f on f.track_id = p_track_id
    where d.kind = 'demo' and d.status = 'fingerprinted'
    on conflict (demo_track_id, talent_profile_id) do update
      set vocal_score = excluded.vocal_score,
          style_score = excluded.style_score,
          production_score = excluded.production_score,
          blended_score = excluded.blended_score,
          talent_track_id = excluded.talent_track_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security.
-- The BLUR IS SERVER-ENFORCED: clients never select from `matches` or
-- `profiles` of other users directly — match reads go through security-definer
-- RPCs (or the Next.js server with the service key) that redact identity
-- fields unless the caller holds an active covering subscription.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table tracks enable row level security;
alter table fingerprints enable row level security;
alter table matches enable row level security;
alter table interests enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table thread_reads enable row level security;
alter table subscriptions enable row level security;

create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile write" on profiles for all using (auth.uid() = id);
create policy "own tracks" on tracks for all using (auth.uid() = owner_id);
create policy "own subscription read" on subscriptions for select using (auth.uid() = user_id);
create policy "own interests" on interests for all using (auth.uid() = profile_id);
create policy "own threads read" on threads for select
  using (auth.uid() = creator_id or auth.uid() = talent_id);
create policy "thread messages read" on messages for select using (
  exists (select 1 from threads th
          where th.id = thread_id and (th.creator_id = auth.uid() or th.talent_id = auth.uid()))
);
create policy "thread messages write" on messages for insert with check (
  sender_id = auth.uid() and exists (
    select 1 from threads th
    where th.id = thread_id and (th.creator_id = auth.uid() or th.talent_id = auth.uid()))
);
create policy "own reads" on thread_reads for all using (auth.uid() = profile_id);
-- fingerprints + matches: no client policies on purpose — service role only.
