/*
  Demo-mode data store.

  When Supabase env vars are absent the whole product runs against this
  in-memory store so the full loop can be experienced with zero configuration:
  upload → fingerprint → blurred matches (voice audible) → subscribe →
  reveal → send a request → the other side accepts → conversation.

  State lives on globalThis so it survives dev-server HMR. It resets on
  server restart; that is fine for a demo.
*/

import type {
  ComponentScores,
  Profile,
  ProfileEdit,
  RequestState,
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
  createdAt: string;
  /** profileIds who dismissed this from their feed */
  passedBy: Set<string>;
}

export interface DemoRequest {
  id: string;
  matchId: string;
  senderId: string;
  recipientId: string;
  state: RequestState;
  note: string | null;
  createdAt: string;
  threadId: string | null;
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
  requests: Map<string, DemoRequest>;
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
    requests: new Map(),
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

/** Deterministic preview seed for a member's reference audio. */
export function previewSeedFor(profileId: string): number {
  return hashString(profileId + ":ref");
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
    location: "",
    genres: [],
    craft: "",
    bio: "",
    avatarSeed: hashString(id) % 97,
  });

  if (role === "artist" || role === "producer") seedTalentSide(user);
  return user;
}

export function updateDemoProfile(userId: string, edit: ProfileEdit) {
  const d = db();
  const profile = d.profiles.get(userId);
  if (!profile) return;
  profile.displayName = edit.displayName;
  profile.location = edit.location;
  profile.bio = edit.bio;
  profile.genres = edit.genres;
  profile.craft = edit.craft;
  const user = d.users.get(userId);
  if (user) user.displayName = edit.displayName;
}

const CREATOR_REQUEST_NOTES = [
  "I wrote this hoping a voice exactly like yours existed. Would you cut it?",
  "Your reference reel is the exact world this track belongs in — want to build it out together?",
];

/** Give a fresh demo artist/producer a reference upload, a feed, and inbound. */
function seedTalentSide(user: DemoUser) {
  const d = db();
  const refTrack: Track = {
    id: nextId("t"),
    ownerId: user.id,
    kind: user.role === "artist" ? "voice" : "production",
    title: user.role === "artist" ? "Voice reference — 3 songs" : "Production reel — 4 cuts",
    durationSec: 412,
    createdAt: iso(60 * 24 * 3),
    seed: previewSeedFor(user.id),
    status: "fingerprinted",
    consentConfirmed: true,
  };
  d.tracks.set(refTrack.id, refTrack);

  const created: DemoMatch[] = [];
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
    const match: DemoMatch = {
      id,
      demoTrackId: track.id,
      talentProfileId: user.id,
      scores,
      createdAt: track.createdAt,
      passedBy: new Set(),
    };
    d.matches.set(id, match);
    created.push(match);
  });

  // Two creators have already reached out — inbound is free to answer, so a
  // brand-new artist sees the model working before paying anything.
  created
    .slice()
    .sort((a, b) => b.scores.blended - a.scores.blended)
    .slice(0, 2)
    .forEach((match, i) => {
      const senderId = d.tracks.get(match.demoTrackId)!.ownerId;
      const id = nextId("rq");
      d.requests.set(id, {
        id,
        matchId: match.id,
        senderId,
        recipientId: user.id,
        state: "pending",
        note: CREATOR_REQUEST_NOTES[i % CREATOR_REQUEST_NOTES.length],
        createdAt: iso(60 * (i * 7 + 2)),
        threadId: null,
      });
    });
}

/* ---- tracks + matching ------------------------------------------------ */

export function createDemoTrack(user: DemoUser, title: string, kind: Track["kind"]): Track {
  const d = db();
  const isRef = kind !== "demo";
  const track: Track = {
    id: nextId("t"),
    ownerId: user.id,
    kind,
    title,
    durationSec: 120 + (hashString(title) % 140),
    createdAt: iso(0),
    seed: isRef ? previewSeedFor(user.id) : hashString(user.id + ":" + title + ":" + d.counter),
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
        createdAt: track.createdAt,
        passedBy: new Set(),
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

export function requestForMatch(matchId: string): DemoRequest | null {
  for (const r of db().requests.values()) if (r.matchId === matchId) return r;
  return null;
}

export function requestsFor(profileId: string): DemoRequest[] {
  return Array.from(db().requests.values())
    .filter((r) => r.senderId === profileId || r.recipientId === profileId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The two parties on a match: the creator who uploaded, and the talent. */
export function partiesFor(matchId: string): { creatorId: string; talentId: string } | null {
  const d = db();
  const match = d.matches.get(matchId);
  if (!match) return null;
  const track = d.tracks.get(match.demoTrackId);
  if (!track) return null;
  return { creatorId: track.ownerId, talentId: match.talentProfileId };
}

/* ---- requests + threads ------------------------------------------------ */

const TALENT_ACCEPT_OPENERS = [
  "Just played this three times back to back. The hook sits exactly where my voice lives — let's talk.",
  "This is uncanny — it's basically written in my register. What's the story behind it?",
  "I'd cut this tomorrow. Do you have stems, or is it topline-only for now?",
];

const CREATOR_ACCEPT_OPENERS = [
  "You heard it! I wrote this hoping someone with exactly your sound existed. Want the full track?",
  "Amazing — your reference reel is precisely the world this belongs in. Happy to send everything over.",
];

/**
 * Send a collaboration request. Only one request may exist per match, so a
 * pairing can never be pestered twice. In demo mode a strongly-matched seeded
 * counterparty accepts straight away, so the loop can be felt end to end.
 */
export function sendRequest(
  senderId: string,
  matchId: string,
  note: string | null
): { requestId: string; state: RequestState; threadId: string | null } | null {
  const d = db();
  const parties = partiesFor(matchId);
  const match = d.matches.get(matchId);
  if (!parties || !match) return null;
  if (senderId !== parties.creatorId && senderId !== parties.talentId) return null;

  const existing = requestForMatch(matchId);
  if (existing) {
    return { requestId: existing.id, state: existing.state, threadId: existing.threadId };
  }

  const recipientId = senderId === parties.creatorId ? parties.talentId : parties.creatorId;
  const id = nextId("rq");
  const request: DemoRequest = {
    id,
    matchId,
    senderId,
    recipientId,
    state: "pending",
    note,
    createdAt: iso(0),
    threadId: null,
  };
  d.requests.set(id, request);

  // Seeded (non-signed-up) counterparties answer strong matches immediately.
  const recipientIsSeeded = !d.users.has(recipientId);
  if (recipientIsSeeded && match.scores.blended >= 84) {
    acceptRequest(recipientId, id);
  }
  return { requestId: id, state: request.state, threadId: request.threadId };
}

export function acceptRequest(recipientId: string, requestId: string): string | null {
  const d = db();
  const request = d.requests.get(requestId);
  if (!request || request.recipientId !== recipientId || request.state !== "pending") return null;

  const threadId = nextId("th");
  const senderIsSeeded = !d.users.has(request.senderId);
  const recipientIsSeeded = !d.users.has(recipientId);
  const parties = partiesFor(request.matchId);
  const recipientIsTalent = parties ? recipientId === parties.talentId : true;

  // Whichever side is a seeded stand-in opens with a line, so the thread lives.
  let opener: { id: string; senderId: string; body: string; sentAt: string } | null = null;
  if (recipientIsSeeded) {
    const pool = recipientIsTalent ? TALENT_ACCEPT_OPENERS : CREATOR_ACCEPT_OPENERS;
    opener = {
      id: nextId("msg"),
      senderId: recipientId,
      body: pool[hashString(requestId) % pool.length],
      sentAt: iso(0),
    };
  } else if (senderIsSeeded) {
    const pool = recipientIsTalent ? CREATOR_ACCEPT_OPENERS : TALENT_ACCEPT_OPENERS;
    opener = {
      id: nextId("msg"),
      senderId: request.senderId,
      body: pool[hashString(requestId) % pool.length],
      sentAt: iso(0),
    };
  }

  d.threads.set(threadId, {
    id: threadId,
    matchId: request.matchId,
    participantIds: [request.senderId, recipientId],
    messages: opener ? [opener] : [],
    readAt: {},
  });
  request.state = "accepted";
  request.threadId = threadId;
  return threadId;
}

export function declineRequest(recipientId: string, requestId: string) {
  const request = db().requests.get(requestId);
  if (!request || request.recipientId !== recipientId || request.state !== "pending") return;
  request.state = "declined";
}

export function passMatch(profileId: string, matchId: string) {
  const match = db().matches.get(matchId);
  if (match) match.passedBy.add(profileId);
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

const SEEDED_REPLIES = [
  "Perfect — send the full track and any stems you have. I'll block out studio time this week.",
  "Listening now. This could really be something. Let's take it to the studio.",
  "Got it. I'll live with it for a day or two and come back with thoughts on the arrangement.",
];

export function sendMessage(userId: string, threadId: string, body: string) {
  const d = db();
  const thread = d.threads.get(threadId);
  if (!thread || !thread.participantIds.includes(userId)) return;
  thread.messages.push({ id: nextId("msg"), senderId: userId, body, sentAt: iso(0) });
  thread.readAt[userId] = iso(0);
  // Seeded counterparties reply once, so the inbox feels alive.
  const other = thread.participantIds.find((p) => p !== userId)!;
  if (!d.users.has(other)) {
    const mineCount = thread.messages.filter((m) => m.senderId === userId).length;
    if (mineCount === 1) {
      thread.messages.push({
        id: nextId("msg"),
        senderId: other,
        body: SEEDED_REPLIES[hashString(threadId) % SEEDED_REPLIES.length],
        sentAt: iso(0),
      });
    }
  }
}

export function markThreadRead(userId: string, threadId: string) {
  const thread = db().threads.get(threadId);
  if (thread) thread.readAt[userId] = iso(0);
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
