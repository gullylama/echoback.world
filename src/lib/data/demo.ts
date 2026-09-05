/*
  Demo-mode implementation of the data layer (in-memory, seeded).
  Same async interface as ./supabase so pages never know the difference.
*/

import type {
  FeedItemView,
  FeedQuery,
  MatchView,
  MessageView,
  ProfileEdit,
  ProfileView,
  RequestSummary,
  RequestView,
  SessionUser,
  ThreadView,
  Tier,
  Track,
  TrackKind,
} from "@/lib/types";
import {
  acceptRequest as storeAccept,
  cancelSubscription as storeCancelSubscription,
  createDemoTrack,
  db,
  declineRequest as storeDecline,
  markThreadRead as storeMarkThreadRead,
  matchesForDemoTrack,
  matchesForTalent,
  partiesFor,
  passMatch as storePassMatch,
  previewSeedFor,
  requestForMatch,
  requestsFor,
  sendMessage as storeSendMessage,
  sendRequest as storeSendRequest,
  setSubscription as storeSetSubscription,
  threadsFor,
  tracksFor,
  updateDemoProfile,
  type DemoMatch,
  type DemoRequest,
} from "@/lib/demo/store";
import { hashString, obscureName } from "@/lib/demo/seed";
import { canInitiate, creatorCanReveal, hasActiveSub, talentView } from "./shared";

function summarise(request: DemoRequest | null, viewerId: string): RequestSummary | null {
  if (!request) return null;
  return {
    id: request.id,
    state: request.state,
    mine: request.senderId === viewerId,
    threadId: request.threadId,
  };
}

/* ---- tracks ----------------------------------------------------------- */

export async function getTracks(user: SessionUser): Promise<Track[]> {
  return tracksFor(user.id);
}

export async function getTrack(user: SessionUser, trackId: string): Promise<Track | null> {
  const t = db().tracks.get(trackId);
  if (!t || t.ownerId !== user.id) return null;
  return t;
}

export async function createTrack(
  user: SessionUser,
  input: { title: string; kind: TrackKind; file?: File | null }
): Promise<Track | null> {
  const u = db().users.get(user.id);
  if (!u) return null;
  return createDemoTrack(u, input.title, input.kind);
}

export async function deleteTrack(user: SessionUser, trackId: string): Promise<void> {
  const d = db();
  const t = d.tracks.get(trackId);
  if (!t || t.ownerId !== user.id) return;
  for (const m of Array.from(d.matches.values())) {
    if (m.demoTrackId === trackId) {
      for (const r of Array.from(d.requests.values())) {
        if (r.matchId === m.id) d.requests.delete(r.id);
      }
      d.matches.delete(m.id);
    }
  }
  d.tracks.delete(trackId);
}

/* ---- creator side ----------------------------------------------------- */

function toMatchView(user: SessionUser, m: DemoMatch): MatchView {
  const talent = db().profiles.get(m.talentProfileId)!;
  const revealed = creatorCanReveal(user, talent.role as "artist" | "producer");
  return {
    id: m.id,
    demoTrackId: m.demoTrackId,
    scores: m.scores,
    revealed,
    // The voice is audible before paying — reaching it is what costs.
    previewSeed: previewSeedFor(m.talentProfileId),
    talent: talentView(revealed, talent, m.id),
    request: summarise(requestForMatch(m.id), user.id),
  };
}

export async function getMatchesForTrack(user: SessionUser, trackId: string): Promise<MatchView[]> {
  const track = await getTrack(user, trackId);
  if (!track) return [];
  return matchesForDemoTrack(trackId).map((m) => toMatchView(user, m));
}

export async function countMatchesForTrack(
  user: SessionUser,
  trackId: string
): Promise<{ artists: number; producers: number }> {
  const track = await getTrack(user, trackId);
  if (!track) return { artists: 0, producers: 0 };
  const ms = matchesForDemoTrack(trackId);
  const profiles = db().profiles;
  return {
    artists: ms.filter((m) => profiles.get(m.talentProfileId)?.role === "artist").length,
    producers: ms.filter((m) => profiles.get(m.talentProfileId)?.role === "producer").length,
  };
}

/* ---- talent side ------------------------------------------------------ */

function toFeedItem(user: SessionUser, m: DemoMatch): FeedItemView {
  const track = db().tracks.get(m.demoTrackId)!;
  const creator = db().profiles.get(track.ownerId);
  const revealed = hasActiveSub(user);
  return {
    id: m.id,
    scores: m.scores,
    revealed,
    createdAt: m.createdAt,
    demo: revealed
      ? {
          title: track.title,
          durationSec: track.durationSec,
          seed: track.seed,
          creatorName: creator?.displayName ?? "Creator",
          genres: creator?.genres ?? [],
        }
      : {
          title: obscureName(m.id + ":t"),
          durationSec: track.durationSec,
          // decoy waveform only — unrevealed feed items are not playable
          seed: hashString(m.id + ":shape"),
          creatorName: obscureName(m.id + ":c"),
          genres: creator?.genres ?? [],
        },
    request: summarise(requestForMatch(m.id), user.id),
  };
}

function untriaged(user: SessionUser): DemoMatch[] {
  return matchesForTalent(user.id).filter(
    (m) => !m.passedBy.has(user.id) && !requestForMatch(m.id)
  );
}

export async function getFeed(user: SessionUser, query: FeedQuery = {}): Promise<FeedItemView[]> {
  let items = untriaged(user).map((m) => toFeedItem(user, m));

  if (query.genre) {
    items = items.filter((i) => i.demo.genres.includes(query.genre!));
  }
  if (query.q && query.q.trim()) {
    const needle = query.q.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.demo.title.toLowerCase().includes(needle) ||
        i.demo.creatorName.toLowerCase().includes(needle)
    );
  }
  if (query.sort === "newest") {
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    items.sort((a, b) => b.scores.blended - a.scores.blended);
  }
  return items;
}

export async function countFeed(user: SessionUser): Promise<number> {
  return untriaged(user).length;
}

/** Genres present in a member's feed, for the filter control. */
export async function feedGenres(user: SessionUser): Promise<string[]> {
  const set = new Set<string>();
  for (const m of untriaged(user)) {
    const track = db().tracks.get(m.demoTrackId);
    const creator = track ? db().profiles.get(track.ownerId) : null;
    for (const g of creator?.genres ?? []) set.add(g);
  }
  return Array.from(set).sort();
}

/* ---- requests --------------------------------------------------------- */

export async function sendRequest(
  user: SessionUser,
  matchId: string,
  note: string | null
): Promise<{ ok: boolean; state?: string; threadId?: string | null; reason?: string }> {
  const parties = partiesFor(matchId);
  if (!parties) return { ok: false, reason: "not_found" };
  if (user.id !== parties.creatorId && user.id !== parties.talentId) {
    return { ok: false, reason: "not_found" };
  }
  const counterpartyId = user.id === parties.creatorId ? parties.talentId : parties.creatorId;
  const counterparty = db().profiles.get(counterpartyId);
  if (!counterparty) return { ok: false, reason: "not_found" };
  if (!canInitiate(user, counterparty.role)) return { ok: false, reason: "subscription" };

  const result = storeSendRequest(user.id, matchId, note);
  if (!result) return { ok: false, reason: "not_found" };
  return { ok: true, state: result.state, threadId: result.threadId };
}

export async function respondToRequest(
  user: SessionUser,
  requestId: string,
  accept: boolean
): Promise<string | null> {
  if (accept) return storeAccept(user.id, requestId);
  storeDecline(user.id, requestId);
  return null;
}

export async function passMatch(user: SessionUser, matchId: string): Promise<void> {
  storePassMatch(user.id, matchId);
}

function toRequestView(user: SessionUser, r: DemoRequest): RequestView | null {
  const d = db();
  const match = d.matches.get(r.matchId);
  if (!match) return null;
  const track = d.tracks.get(match.demoTrackId);
  const incoming = r.recipientId === user.id;
  const otherId = incoming ? r.senderId : r.recipientId;
  const other = d.profiles.get(otherId);
  if (!other || !track) return null;
  return {
    id: r.id,
    matchId: r.matchId,
    incoming,
    state: r.state,
    note: r.note,
    sentAt: r.createdAt,
    threadId: r.threadId,
    scores: match.scores,
    counterparty: {
      profileId: other.id,
      displayName: other.displayName,
      role: other.role,
      avatarSeed: other.avatarSeed,
      craft: other.craft,
      genres: other.genres,
      location: other.location,
    },
    // Always playable: you cannot judge a request you cannot hear.
    track: { title: track.title, seed: track.seed, durationSec: track.durationSec },
  };
}

export async function getRequests(user: SessionUser): Promise<RequestView[]> {
  return requestsFor(user.id)
    .map((r) => toRequestView(user, r))
    .filter((r): r is RequestView => r !== null);
}

export async function countPendingRequests(user: SessionUser): Promise<number> {
  return requestsFor(user.id).filter((r) => r.recipientId === user.id && r.state === "pending")
    .length;
}

/* ---- inbox ------------------------------------------------------------ */

export async function getThreads(user: SessionUser): Promise<ThreadView[]> {
  return threadsFor(user.id).map((t) => {
    const otherId = t.participantIds.find((p) => p !== user.id)!;
    const other = db().profiles.get(otherId);
    const match = db().matches.get(t.matchId);
    const demo = match ? db().tracks.get(match.demoTrackId) : null;
    const last = t.messages.at(-1) ?? null;
    const readAt = t.readAt[user.id];
    return {
      id: t.id,
      otherPartyId: otherId,
      otherPartyName: other?.displayName ?? "Member",
      otherPartyRole: other?.role ?? "artist",
      demoTitle: demo?.title ?? "Track",
      avatarSeed: other?.avatarSeed ?? 1,
      lastMessage: last?.body ?? null,
      lastMessageAt: last?.sentAt ?? null,
      unread: Boolean(last && last.senderId !== user.id && (!readAt || readAt < last.sentAt)),
    };
  });
}

export async function getThread(
  user: SessionUser,
  threadId: string
): Promise<{ meta: ThreadView; messages: MessageView[] } | null> {
  const t = db().threads.get(threadId);
  if (!t || !t.participantIds.includes(user.id)) return null;
  const meta = (await getThreads(user)).find((x) => x.id === threadId)!;
  return {
    meta,
    messages: t.messages.map((m) => ({
      id: m.id,
      mine: m.senderId === user.id,
      body: m.body,
      sentAt: m.sentAt,
    })),
  };
}

export async function countUnread(user: SessionUser): Promise<number> {
  return (await getThreads(user)).filter((t) => t.unread).length;
}

export async function sendMessage(user: SessionUser, threadId: string, body: string): Promise<void> {
  storeSendMessage(user.id, threadId, body);
}

export async function markThreadRead(user: SessionUser, threadId: string): Promise<void> {
  storeMarkThreadRead(user.id, threadId);
}

/* ---- profiles ---------------------------------------------------------- */

export async function updateProfile(user: SessionUser, edit: ProfileEdit): Promise<void> {
  updateDemoProfile(user.id, edit);
}

export async function getOwnProfile(user: SessionUser): Promise<ProfileView | null> {
  return buildProfileView(user.id);
}

function buildProfileView(profileId: string): ProfileView | null {
  const profile = db().profiles.get(profileId);
  if (!profile) return null;
  const refs = tracksFor(profileId).filter((t) => t.kind !== "demo");
  return {
    id: profile.id,
    role: profile.role,
    displayName: profile.displayName,
    location: profile.location,
    bio: profile.bio,
    genres: profile.genres,
    craft: profile.craft,
    avatarSeed: profile.avatarSeed,
    previewSeed: profile.role === "creator" ? null : previewSeedFor(profile.id),
    referenceCount: refs.length,
  };
}

/**
 * A profile is visible to you if it's your own, if you're in a conversation
 * or a request with them, or if you're subscribed and they're one of your
 * matches.
 */
export async function getProfile(
  user: SessionUser,
  profileId: string
): Promise<ProfileView | null> {
  if (profileId === user.id) return buildProfileView(profileId);
  const d = db();

  for (const t of threadsFor(user.id)) {
    if (t.participantIds.includes(profileId)) return buildProfileView(profileId);
  }
  for (const r of requestsFor(user.id)) {
    if (r.senderId === profileId || r.recipientId === profileId) return buildProfileView(profileId);
  }

  const target = d.profiles.get(profileId);
  if (!target) return null;

  if (user.role === "creator") {
    if (target.role === "creator") return null;
    if (!creatorCanReveal(user, target.role as "artist" | "producer")) return null;
    const mine = new Set(tracksFor(user.id).map((t) => t.id));
    for (const m of d.matches.values()) {
      if (mine.has(m.demoTrackId) && m.talentProfileId === profileId) {
        return buildProfileView(profileId);
      }
    }
    return null;
  }

  if (!hasActiveSub(user)) return null;
  for (const m of matchesForTalent(user.id)) {
    const track = d.tracks.get(m.demoTrackId);
    if (track?.ownerId === profileId) return buildProfileView(profileId);
  }
  return null;
}

/* ---- billing ---------------------------------------------------------- */

export async function setSubscription(user: SessionUser, tier: Tier): Promise<void> {
  const u = db().users.get(user.id);
  if (u) storeSetSubscription(u, tier);
}

export async function cancelSubscription(user: SessionUser): Promise<void> {
  const u = db().users.get(user.id);
  if (u) storeCancelSubscription(u);
}
