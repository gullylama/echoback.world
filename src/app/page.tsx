import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/site-chrome";
import { EchoPulse, SimilarityBadge, ComponentBars } from "@/components/meters";
import { TrackPlayer } from "@/components/track-player";
import { Avatar } from "@/components/avatar";
import { TIER_META } from "@/lib/types";

export default function Landing() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Reframe />
        <HowItWorks />
        <Engine />
        <ForTalent />
        <PricingTeaser />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-28">
        <div className="animate-rise">
          <p className="label text-ink-faint">Echolocation for music</p>
          <h1 className="mt-5 max-w-xl text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-6xl">
            Your demo already sounds like someone.
            <span className="mt-3 block text-ink-faint">Find them.</span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-ink-soft">
            EchoBack matches AI-made demos to the real artists and producers whose
            sound they echo. The AI writes the part — a human gets cast in it.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/start?role=creator"
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-ink-soft"
            >
              I have a demo
            </Link>
            <Link
              href="/start?role=artist"
              className="rounded-full border border-hairline bg-paper-raised px-6 py-3 text-sm font-medium transition hover:border-ink-faint"
            >
              I&rsquo;m an artist
            </Link>
            <Link
              href="/start?role=producer"
              className="rounded-full border border-hairline bg-paper-raised px-6 py-3 text-sm font-medium transition hover:border-ink-faint"
            >
              I&rsquo;m a producer
            </Link>
          </div>
          <p className="mt-6 text-xs text-ink-faint">
            Free to upload on every side. Pay only to reveal your matches.
          </p>
        </div>

        <HeroCard />
      </div>
    </section>
  );
}

/** A live match card — the product's core moment, on the front page. */
function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-md animate-rise" style={{ animationDelay: "0.15s" }}>
      <div className="absolute -right-3 -top-3 h-full w-full rounded-2xl border border-hairline bg-paper-raised/70" aria-hidden />
      <div className="relative rounded-2xl border border-hairline bg-paper-raised p-6 shadow-[0_24px_60px_-36px_rgba(22,21,26,0.35)]">
        <div className="flex items-center justify-between">
          <span className="label text-ink-faint">Match returned</span>
          <SimilarityBadge score={94} />
        </div>
        <div className="mt-5 flex items-center gap-4">
          <Avatar seed={11} size={52} />
          <div>
            <p className="text-lg font-semibold tracking-tight">Mara Solene</p>
            <p className="text-sm text-ink-faint">Artist · Alt-R&amp;B · London</p>
          </div>
        </div>
        <TrackPlayer seed={4021} className="mt-5" />
        <div className="mt-5 border-t border-hairline pt-4">
          <ComponentBars vocal={94} style={91} production={0} talentRole="artist" />
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-ink-faint">&ldquo;Midnight Arithmetic&rdquo; — demo, 2:52</span>
          <span className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-ink-soft">
            Express interest
          </span>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-10 -left-14 opacity-70">
        <EchoPulse size={110} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- reframe */

function Reframe() {
  return (
    <section className="border-t border-hairline bg-night text-night-ink">
      <div className="relative mx-auto max-w-6xl overflow-hidden px-5 py-24 sm:px-8 sm:py-32">
        <span
          aria-hidden
          className="kanji pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 select-none text-[16rem] leading-none text-night-raised sm:text-[22rem]"
        >
          響
        </span>
        <div className="relative max-w-2xl">
          <p className="label text-night-soft">The reframe</p>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            AI music isn&rsquo;t a replacement.
            <br />
            It&rsquo;s a demo — a sketch of a song looking for a voice.
          </h2>
          <div className="mt-8 grid gap-6 text-[0.95rem] leading-relaxed text-night-soft sm:grid-cols-2">
            <p>
              Charts are banning AI tracks. Listeners are turning on them. But the
              backlash mistakes the tool for the record. A generated track was never
              the finished thing — it&rsquo;s a pitch, waiting for the human it was
              unknowingly written for.
            </p>
            <p>
              EchoBack closes that loop. Fingerprint the demo, find the real artist
              or producer it sounds like, and make the song for real — with a human
              voice on the master, producer credit on the release, and a legitimate
              path into the existing industry.
            </p>
          </div>
          <p className="mt-10 text-sm font-medium text-night-ink">
            The human is the endpoint. That&rsquo;s the product.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- how it works */

const STEPS = [
  {
    n: "01",
    title: "Send the echo",
    body: "Upload a demo — AI-made or any sketch. Free, with rights and consent confirmed at upload.",
  },
  {
    n: "02",
    title: "The engine listens",
    body: "The track is fingerprinted into three components — voice, style, production — and searched against a library of real artists and producers.",
  },
  {
    n: "03",
    title: "The echo returns",
    body: "A ranked list comes back: real people whose sound your demo already resembles, with per-component similarity.",
  },
  {
    n: "04",
    title: "Connect",
    body: "Subscribe to reveal names and express interest. When it's mutual, an inbox opens — and the song gets made by people.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <p className="label text-ink-faint">How it works</p>
        <h2 className="mt-4 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
          Send an echo. Feel it return.
        </h2>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-paper-raised p-7">
              <span className="font-mono text-sm text-ink-faint">{s.n}</span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- engine */

const VECTORS = [
  {
    name: "vocal_vector",
    label: "Voice",
    body: "Timbre, register, delivery. Matches a demo's vocal character to real singers — so a voice finds the song written in its range.",
    score: 92,
  },
  {
    name: "style_vector",
    label: "Style",
    body: "Genre, mood, writing. The shared context that makes a match feel right rather than merely similar.",
    score: 88,
  },
  {
    name: "production_vector",
    label: "Production",
    body: "Drums, texture, space, mix. Matches independently of the voice — so producers are found on their sound alone.",
    score: 95,
  },
];

function Engine() {
  return (
    <section id="engine" className="scroll-mt-20 border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="label text-ink-faint">The engine</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Not &ldquo;what song is this?&rdquo;
              <br />
              <span className="grad-audio-text">&ldquo;Who does this sound like?&rdquo;</span>
            </h2>
            <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
              Every upload is embedded into three separate vectors and searched with
              nearest-neighbour precision. Separating the components means a demo can
              match a <em>voice</em> and a <em>producer</em> independently — one song,
              two different kinds of collaborator.
            </p>
          </div>
          <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
            {VECTORS.map((v) => (
              <div key={v.name} className="flex flex-col gap-3 bg-paper-raised p-6 sm:flex-row sm:items-center sm:gap-8">
                <div className="w-40 shrink-0">
                  <p className="font-mono text-xs text-ink-faint">{v.name}</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">{v.label}</p>
                </div>
                <p className="flex-1 text-sm leading-relaxed text-ink-soft">{v.body}</p>
                <div className="flex w-full items-center gap-3 sm:w-36">
                  <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-mist">
                    <span className="grad-audio block h-full" style={{ width: `${v.score}%` }} />
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink-soft">{v.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- for talent */

function ForTalent() {
  return (
    <section className="border-t border-hairline">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-2">
        <div>
          <p className="label text-ink-faint">For artists &amp; producers</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            The demos come to you.
          </h2>
          <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
            Upload your voice or your production reel once. From then on, every demo
            that echoes your sound lands in your feed, pre-filtered and ranked. Swipe
            through them like it&rsquo;s nothing — because for you, it is. Zero search
            effort, curated inbound, and you keep <strong className="text-ink">100%</strong> of
            anything you make from a match.
          </p>
          <Link
            href="/start?role=artist"
            className="mt-8 inline-block rounded-full border border-hairline bg-paper-raised px-6 py-3 text-sm font-medium transition hover:border-ink-faint"
          >
            Seed your sound
          </Link>
        </div>
        <div className="relative mx-auto w-full max-w-sm">
          <div className="absolute inset-x-6 -bottom-4 h-full rotate-[-4deg] rounded-2xl border border-hairline bg-paper-raised" aria-hidden />
          <div className="absolute inset-x-3 -bottom-2 h-full rotate-[2deg] rounded-2xl border border-hairline bg-paper-raised" aria-hidden />
          <div className="relative rounded-2xl border border-hairline bg-paper-raised p-6 shadow-[0_24px_60px_-36px_rgba(22,21,26,0.35)]">
            <div className="flex items-center justify-between">
              <span className="label text-ink-faint">Matched to your voice</span>
              <SimilarityBadge score={91} />
            </div>
            <p className="mt-4 text-xl font-semibold tracking-tight">&ldquo;Glasshouse&rdquo;</p>
            <p className="text-sm text-ink-faint">Demo · Alt-R&amp;B · 2:52</p>
            <TrackPlayer seed={77812} className="mt-5" />
            <div className="mt-6 flex items-center justify-center gap-4">
              <span className="grid size-12 place-items-center rounded-full border border-hairline text-ink-faint">✕</span>
              <span className="grad-audio grid size-14 place-items-center rounded-full text-white shadow-lg">
                <svg width="20" height="18" viewBox="0 0 24 22" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- pricing */

function PricingTeaser() {
  return (
    <section className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label text-ink-faint">Pricing</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Free to upload. Pay to reveal.
            </h2>
          </div>
          <Link href="/pricing" className="text-sm font-medium text-ink-soft underline underline-offset-4 transition hover:text-ink">
            Full pricing →
          </Link>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(TIER_META) as (keyof typeof TIER_META)[]).map((tier) => (
            <div key={tier} className="bg-paper-raised p-7">
              <p className="label text-ink-faint">{TIER_META[tier].name}</p>
              <p className="mt-4 text-3xl font-semibold tracking-tight">
                {TIER_META[tier].price}
                <span className="text-sm font-normal text-ink-faint">/mo</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{TIER_META[tier].blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- closing cta */

function ClosingCta() {
  return (
    <section className="border-t border-hairline bg-night text-night-ink">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-5 py-24 text-center sm:px-8 sm:py-28">
        <EchoPulse size={72} />
        <h2 className="mt-10 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Somewhere, a real voice is waiting for the song you just made.
        </h2>
        <Link
          href="/start"
          className="mt-10 rounded-full bg-night-ink px-8 py-3.5 text-sm font-medium text-night transition hover:opacity-85"
        >
          Send the first echo
        </Link>
      </div>
    </section>
  );
}
