# EchoBack — echoback.world

*A demo echoes a real artist's sound; the match echoes back.*

EchoBack is a matching platform — **not** a music generator. Creators upload
demos (AI-made or otherwise) and get a ranked list of the real artists and
producers whose sound the demo resembles. Artists and producers seed a
reference library with their voice and production work, and receive a swipe
feed of demos matched to *their* sound. An inbox opens only on mutual
interest. The AI writes the part; a human gets cast in it.

## Run it now (zero config)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set the app runs in
**demo mode**: an in-memory store with a seeded library of artists and
producers, simulated fingerprinting, and simulated billing — so the entire
loop is experiencable immediately:

1. Join as a **Creator** → upload a demo → see the blurred ranked matches
2. Subscribe (instant in demo mode) → names reveal → express interest
3. Strong matches reciprocate → the mutual-interest **inbox** opens
4. Join as an **Artist** in another browser/profile → blurred feed count →
   subscribe → swipe feed → mutual match overlay

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
  `production_vector` — so a demo matches a *voice* and a *producer*
  independently. See `supabase/migrations/0001_init.sql` and
  `worker/fingerprint.py`.
- **Blur is server-enforced.** Redaction happens in `src/lib/data.ts` before
  anything leaves the server; unsubscribed clients receive obscured
  stand-ins and counts, never real names or contacts. The CSS blur is
  presentation only. In Supabase mode the same rule holds via RLS: clients
  have **no** policies on `matches`/`fingerprints` — reads go through the
  server.
- **Match caching.** Matches are recomputed when new relevant uploads are
  fingerprinted (`refresh_matches_for_track` SQL function), not per view.

## Repository map

```
src/app/                 Routes: landing, start, pricing + (app)/ studio,
                         upload, matches/[trackId], feed, inbox, account
src/app/actions.ts       All mutations (server actions)
src/lib/data.ts          Read layer with server-side redaction/gating
src/lib/demo/            Demo-mode store + seed content
src/lib/stripe.ts        Checkout + price/tier mapping
src/app/api/             stripe/webhook, fingerprint (worker callback)
supabase/migrations/     Full schema: pgvector, matches, inbox, RLS
worker/fingerprint.py    GPU embedding worker (CLAP + Demucs stems)
```

## Going to production

1. **Supabase** — create a project, run `supabase/migrations/0001_init.sql`,
   create a private `audio` storage bucket, set the env vars in
   `.env.example`. Setting the two `NEXT_PUBLIC_SUPABASE_*` vars switches the
   app out of demo mode.
2. **Stripe** — create the four monthly prices, set the price ids + webhook
   secret; point the webhook at `/api/stripe/webhook`.
3. **Fingerprint worker** — run `worker/fingerprint.py` on a GPU host
   (RunPod), sharing `FINGERPRINT_WORKER_SECRET` with the app.
4. **Wire the data layer** — `src/lib/data.ts` + `src/lib/session.ts`
   currently read the demo store; swap their internals to Supabase queries
   (the schema, RLS, and match SQL are already in place, and view-model types
   in `src/lib/types.ts` stay unchanged). This is the one deliberate gap
   between demo and production.
5. **Gate on match quality** (launch plan Phase 0): validate the engine on a
   hand-curated seed set before opening sign-ups.

## Design language

Concept: **echolocation** — send an echo, feel it return, connect. A quiet,
premium editorial base (warm grey/white, near-black ink, hairline rules,
generous *ma* 間) with one reserved accent: the lilac→rose gradient, used
**only for audio** — waveforms, similarity, the returning echo. Type is
Instrument Sans + IBM Plex Mono for data. Tokens live in
`src/app/globals.css`.
