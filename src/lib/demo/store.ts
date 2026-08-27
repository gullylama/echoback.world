/*
  Demo-mode data store.

  When Supabase env vars are absent the whole product runs against this
  in-memory store so the full loop — upload → fingerprint → blurred matches →
  subscribe → reveal → mutual interest → inbox — can be experienced with zero
  configuration. State lives on globalThis so it survives dev-server HMR.
  It resets on server restart; that is fine for a demo.
*/

import type {
  ComponentScores,
  Profile,
  Subscription,
  Tier,
  Track,
  UserRole,
} from "@/lib/types";
import {
  FEED_DEMO_TITLES,
  SEED_ARTISTS,
  SEED_CREATORS,
  SEED_PRODUCERS,
  hashString,
  rng,
} from "./seed";

export interface DemoUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  subscription: Subscription | null;
}

export interface DemoMatch {
  id: string;
  demoTrackId: string;
  talentProfileId: string;
  scores: ComponentScores;
  /** userIds who expressed interest */
  interestedBy: Set<string>;
  /** userIds who passed */
  passedBy: Set<string>;
  mutual: boolean;
}

export interface DemoThread {
  id: string;
  matchId: string;
  participantIds: [string, string];
  messages: { id: string; senderId: string; body: string; sentAt: string }[];
  readAt: Record<string, string>;
}

interface DemoDB {
  users: Map<string, DemoUser>;
  profiles: Map<string, Profile>;
  tracks: Map<string, Track>;
  matches: Map<string, DemoMatch>;
  threads: Map<string, DemoThread>;
  counter: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __echobackDemoDB: DemoDB | undefined;
}

function initDB(): DemoDB {
  const db: DemoDB = {
    users: new Map(),
    profiles: new Map(),
    tracks: new Map(),
    matches: new Map(),
    threads: new Map(),
    counter: 1,
  };
  for (const p of [...SEED_ARTISTS, ...SEED_PRODUCERS, ...SEED_CREATORS]) {
    db.profiles.set(p.id, p);
  }
  return db;
}

export function db(): DemoDB {
  if (!globalThis.__echobackDemoDB) globalThis.__echobackDemoDB = initDB();
  return globalThis.__echobackDemoDB;
}

export function nextId(prefix: string): string {
  return `${prefix}_${db().counter++}`;
}

function iso(minsAgo = 0): string {
  return new Date(Date.now() - minsAgo * 60_000).toISOString();
}

/* ---- scoring ---------------------------------------------------------- */

/**
 * Demo-mode stand-in for the embedding engine: deterministic per
 * (track, talent) pair, shaped so a handful of matches land high.
 */
function scoreFor(trackSeed: number, talent: Profile): ComponentScores {
  const r = rng(trackSeed ^ hashString(talent.id));
  const base = 52 + r() * 46; // 52–98
  const jig = () => Math.max(35, Math.min(99, base + (r() - 0.5) * 14));
  const vocal = talent.role === "artist" ? jig() : 0;
  const production = talent.role === "producer" ? jig() : 0;
  const style = jig();
  const blended =
    talent.role === "artist" ? vocal * 0.55 + style * 0.45 : production * 0.6 + style * 0.4;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { vocal: round(vocal), style: round(style), production: round(production), blended: round(blended) };
}

/* ---- users ------------------------------------------------------------ */

export function createDemoUser(role: UserRole, displayName: string): DemoUser {
  const d = db();
  const id = nextId("u");
  const user: DemoUser = {
    id,
    email: `${displayName.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@demo.echoback.world`,
    role,
    displayName,
    subscription: null,
  };
  d.users.set(id, user);
  d.profiles.set(id, {
    id,
    role,
    displayName,
    location: "Somewhere on Earth",
    genres: [],
    craft: "",
    bio: "",
    avatarSeed: hashString(id) % 97,
  });

  if (role === "artist" || role === "producer") {
    seedTalentSide(user);
  }
  return user;
}

/** Give a fresh demo artist/producer a reference upload + an incoming feed. */
function seedTalentSide(user: DemoUser) {
  const d = db();
  const refTrack: Track = {
    id: nextId("t"),
    ownerId: user.id,
    kind: user.role === "artist" ? "voice" : "production",
    title: user.role === "artist" ? "Voice reference — 3 songs" : "Production reel — 4 cuts",
    durationSec: 412,
    createdAt: iso(60 * 24 * 3),
    seed: hashString(user.id + ":ref"),
    status: "fingerprinted",
    consentConfirmed: true,
  };
  d.tracks.set(refTrack.id, refTrack);

  // Incoming demos matched to this talent.
  FEED_DEMO_TITLES.forEach((f, i) => {
    const track: Track = {
      id: nextId("t"),
      ownerId: f.creatorId,
      kind: "demo",
      title: f.title,
      durationSec: f.dur,
      createdAt: iso(60 * (i * 9 + 4)),
      seed: hashString(f.title),
      status: "fingerprinted",
      consentConfirmed: true,
    };
    d.tracks.set(track.id, track);
    const talentProfile = d.profiles.get(user.id)!;
    const scores = scoreFor(track.seed, { ...talentProfile, role: user.role });
    // Shape the feed so it opens strong.
    const lift = i < 3 ? 88 + (2 - i) * 3.4 : 0;
    if (lift && scores.blended < lift) {
      const s = lift - scores.blended;
      scores.blended = Math.round(lift * 10) / 10;
      if (user.role === "artist") scores.vocal = Math.min(99, Math.round((scores.vocal + s) * 10) / 10);
      else scores.production = Math.min(99, Math.round((scores.production + s) * 10) / 10);
      scores.style = Math.min(99, Math.round((scores.style + s * 0.6) * 10) / 10);
    }
    const id = nextId("m");
    d.matches.set(id, {
      id,
      demoTrackId: track.id,
      talentProfileId: user.id,
      scores,
      interestedBy: new Set(),
      passedBy: new Set(),
      mutual: false,
    });
  });
}

/* ---- tracks + matching ------------------------------------------------ */

export function createDemoTrack(user: DemoUser, title: string, kind: Track["kind"]): Track {
  const d = db();
  const track: Track = {
    id: nextId("t"),
    ownerId: user.id,
    kind,
    title,
    durationSec: 120 + (hashString(title) % 140),
    createdAt: iso(0),
    seed: hashString(user.id + ":" + title + ":" + d.counter),
    status: "fingerprinted",
    consentConfirmed: true,
  };
  d.tracks.set(track.id, track);

  if (kind === "demo") {
    // "Run the engine": match against all seeded talent.
    for (const talent of [...SEED_ARTISTS, ...SEED_PRODUCERS]) {
      const scores = scoreFor(track.seed, talent);
      if (scores.blended < 55) continue;
      const id = nextId("m");
      d.matches.set(id, {
        id,
        demoTrackId: track.id,
        talentProfileId: talent.id,
        scores,
        interestedBy: new Set(),
        passedBy: new Set(),
        mutual: false,
      });
    }
  }
  return track;
}

export function tracksFor(userId: string): Track[] {
  return Array.from(db().tracks.values())
    .filter((t) => t.ownerId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function matchesForDemoTrack(trackId: string): DemoMatch[] {
  return Array.from(db().matches.values())
    .filter((m) => m.demoTrackId === trackId)
    .sort((a, b) => b.scores.blended - a.scores.blended);
}

export function matchesForTalent(talentId: string): DemoMatch[] {
  return Array.from(db().matches.values())
    .filter((m) => m.talentProfileId === talentId)
    .sort((a, b) => b.scores.blended - a.scores.blended);
}

/* ---- interest + threads ----------------------------------------------- */

const TALENT_OPENERS = [
  "Just played this three times back to back. The hook sits exactly where my voice lives — let's talk.",
  "This is uncanny — it's basically written in my register. What's the story behind it?",
  "I'd cut this tomorrow. Do you have stems, or is it topline-only for now?",
];

const CREATOR_OPENERS = [
  "You heard it! I wrote this hoping someone with exactly your sound existed. Want the full track?",
  "Amazing — your reference reel is precisely the world this demo belongs in. Happy to send everything over.",
];

/**
 * Express interest. In demo mode, strongly-matched seeded counterparties
 * reciprocate immediately so the mutual-interest loop can be experienced.
 */
export function expressInterest(user: DemoUser, matchId: string): { mutual: boolean; threadId?: string } {
  const d = db();
  const match = d.matches.get(matchId);
  if (!match) return { mutual: false };
  match.interestedBy.add(user.id);
  match.passedBy.delete(user.id);

  const iAmTalent = match.talentProfileId === user.id;
  const counterpartyId = iAmTalent ? d.tracks.get(match.demoTrackId)!.ownerId : match.talentProfileId;
  const counterpartyIsSeeded = !d.users.has(counterpartyId);

  if (counterpartyIsSeeded && match.scores.blended >= 84) {
    match.interestedBy.add(counterpartyId);
  }

  const bothIn =
    match.interestedBy.has(user.id) && match.interestedBy.has(counterpartyId);
  if (bothIn && !match.mutual) {
    match.mutual = true;
    const threadId = nextId("th");
    const openers = iAmTalent ? CREATOR_OPENERS : TALENT_OPENERS;
    const opener = openers[hashString(matchId) % openers.length];
    d.threads.set(threadId, {
      id: threadId,
      matchId,
      participantIds: [user.id, counterpartyId],
      messages: counterpartyIsSeeded
        ? [{ id: nextId("msg"), senderId: counterpartyId, body: opener, sentAt: iso(0) }]
        : [],
      readAt: { [user.id]: iso(0) },
    });
    return { mutual: true, threadId };
  }
  return { mutual: match.mutual };
}

export function passMatch(user: DemoUser, matchId: string) {
  const match = db().matches.get(matchId);
  if (!match) return;
  match.passedBy.add(user.id);
  match.interestedBy.delete(user.id);
}

export function threadsFor(userId: string): DemoThread[] {
  return Array.from(db().threads.values())
    .filter((t) => t.participantIds.includes(userId))
    .sort((a, b) => {
      const la = a.messages.at(-1)?.sentAt ?? "";
      const lb = b.messages.at(-1)?.sentAt ?? "";
      return lb.localeCompare(la);
    });
}

const TALENT_REPLIES = [
  "Perfect — send the full track and any stems you have. I'll block out studio time this week.",
  "Listening now. This could really be something. Let's take it to the studio.",
  "Got it. I'll live with it for a day or two and come back with thoughts on the arrangement.",
];

export function sendMessage(user: DemoUser, threadId: string, body: string) {
  const d = db();
  const thread = d.threads.get(threadId);
  if (!thread || !thread.participantIds.includes(user.id)) return;
  thread.messages.push({ id: nextId("msg"), senderId: user.id, body, sentAt: iso(0) });
  thread.readAt[user.id] = iso(0);
  // Seeded counterparties reply once, so the inbox feels alive.
  const other = thread.participantIds.find((p) => p !== user.id)!;
  if (!d.users.has(other)) {
    const mineCount = thread.messages.filter((m) => m.senderId === user.id).length;
    if (mineCount === 1) {
      thread.messages.push({
        id: nextId("msg"),
        senderId: other,
        body: TALENT_REPLIES[hashString(threadId) % TALENT_REPLIES.length],
        sentAt: iso(0),
      });
    }
  }
}

export function markThreadRead(user: DemoUser, threadId: string) {
  const thread = db().threads.get(threadId);
  if (thread) thread.readAt[user.id] = iso(0);
}

/* ---- billing ---------------------------------------------------------- */

export function setSubscription(user: DemoUser, tier: Tier) {
  const renews = new Date();
  renews.setMonth(renews.getMonth() + 1);
  user.subscription = { tier, status: "active", renewsAt: renews.toISOString() };
}

export function cancelSubscription(user: DemoUser) {
  if (user.subscription) user.subscription.status = "lapsed";
}
