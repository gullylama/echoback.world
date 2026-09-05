# EchoBack — echoback.world

*Your music echoes a real artist's sound; the match echoes back.*

EchoBack is a matching platform — **not** a music generator. Creators upload
AI-made tracks and get a ranked list of the real artists and producers whose
sound the track resembles. Artists and producers seed a reference library with
their voice and production work, and get a searchable feed of tracks matched to
*their* sound. The AI writes the part; a human gets cast in it.

## The access model

> **Payment buys the right to make the first move. Answering is always free.**

Nobody can ever be unreachable because they didn't pay, so a paying member
always reaches a real, reachable human.

| | Free for everyone | What subscribing adds |
|---|---|---|
| **Creator** | Unlimited uploads · match counts and ranked list · **hear what every match sounds like** · answer anyone who asks for them | See who the matches are · ask them to work with you |
| **Artist / Producer** | Reference uploads · count of matched tracks · **read, hear and answer every incoming request** · keep every conversation | Search, filter and play the whole matched feed · ask creators first |

A request carries an optional note; the recipient hears the track and accepts
or declines for free. Accepting opens the conversation. Only one request may
exist per pairing, so nobody gets pestered twice, and only subscribers can
send — money is the spam filter. Conversations stay open even if a
subscription lapses: you are never silenced mid-collaboration.

## Run it now (zero config)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set the app runs in
**demo mode**: an in-memory store with a seeded library of artists and
producers, simulated fingerprinting, and simulated billing — so the entire
loop is experiencable immediately:

1. Join as a **Creator** → upload a track → see blurred ranked matches you can
   already *hear*
2. Subscribe (instant in demo mode) → names reveal → send a request with a note
3. Join as an **Artist** in another browser → two creators are already waiting
   in your inbox → hear their tracks and accept, **without subscribing**
4. Subscribe as the artist → the searchable feed unlocks (sort, filter, swipe)

Audio previews in demo mode are synthesised in-browser (a pentatonic phrase
through a feedback delay — every preview literally echoes); in production the
player streams short preview clips from storage.

## Architecture (TRD)

```
Next.js App Router (Vercel, PWA)
 ├─ Auth ────────── Supabase Auth
 ├─ Upload ──────── Supabase Storage (raw audio)
 │                    └─ worker/fingerprint.py (GPU: CLAP + Demucs)
 │                         └─ POST /api/fingerprint → vectors + match refresh
 ├─ Matching ────── Postgres + pgvector (3 component vectors/track)
 ├─ Billing ─────── Stripe (4 monthly tiers) → /api/stripe/webhook
 └─ Email ───────── Resend
```

- **Three component vectors** per track — `vocal_vector`, `style_vector`,
  `production_vector` — so one track matches a *voice* and a *producer*
  independently. See `supabase/migrations/0001_init.sql` and
  `worker/fingerprint.py`.
- **Blur is server-enforced.** Redaction happens in `src/lib/data/` before
  anything leaves the server; unsubscribed clients receive obscured
  stand-ins and counts, never real names or contacts. The CSS blur is
  presentation only. In Supabase mode the same rule holds via RLS: clients
  have **no** policies on `matches`/`fingerprints` — reads go through the
  server.
- **Match caching.** Matches are recomputed when new relevant uploads are
  fingerprinted (`refresh_matches_for_track` SQL function), not per view.
- **Profiles.** Members edit their location, craft line, genres and bio on
  `/account`; profiles are visible at `/profile/[id]` to anyone they share a
  request or conversation with, and to subscribers among their matches.

## Repository map

```
src/app/                 Routes: landing, start, pricing + (app)/ studio,
                         upload, matches/[trackId], feed, inbox, account
src/app/actions.ts       All mutations (server actions)
src/lib/data/shared.ts   Gating rules — who may reveal, who may initiate
src/lib/data/            Read layer: demo + Supabase behind one interface
src/lib/demo/            Demo-mode store + seed content
src/lib/stripe.ts        Checkout + price/tier mapping
src/app/api/             stripe/webhook, fingerprint (worker callback)
supabase/migrations/     Schema: pgvector, matches, requests, inbox, RLS
supabase/setup.sql       One-shot script for a fresh Supabase project
worker/fingerprint.py    GPU embedding worker (CLAP + Demucs stems)
```

## Going to production

1. **Supabase** — create a project, run the SQL files in
   `supabase/migrations/` in order, create a private `audio` storage bucket,
   and set the env vars in `.env.example`. Setting the two
   `NEXT_PUBLIC_SUPABASE_*` vars switches the app out of demo mode: real
   accounts (email/password + Google), persistent uploads, matches and
   conversations all run against Supabase via `src/lib/data/supabase.ts`.
2. **Google sign-in** — in Supabase Auth → Providers, enable Google and add
   OAuth credentials from Google Cloud Console; set the authorized redirect
   to your Supabase callback URL. The app handles the rest via
   `/auth/callback` (first-time Google users pick a role in onboarding).
3. **Stripe** — create the four monthly prices, set the price ids + webhook
   secret; point the webhook at `/api/stripe/webhook`.
4. **Fingerprint worker** — run `worker/fingerprint.py` on a GPU host
   (RunPod), sharing `FINGERPRINT_WORKER_SECRET` with the app. Uploads sit
   in "the engine is listening" state until the worker posts vectors back.
5. **Gate on match quality** (launch plan Phase 0): validate the engine on a
   hand-curated seed set before opening sign-ups.

## Design language

Concept: **echolocation** — send an echo, feel it return, connect. A quiet,
premium editorial base in mineral-water white, with caustic light pools
drifting behind the page, near-black ink, hairline rules and generous
negative space. One reserved accent: the lilac→rose gradient, used **only for
audio** — waveforms, similarity, the returning echo. Sound itself is drawn as
soft indigo ink-blur, with sharp serif words surfacing from it. Type is
Instrument Sans, Newsreader for display, IBM Plex Mono for data. Tokens live
in `src/app/globals.css`.
