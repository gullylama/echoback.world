/*
  Demo-mode implementation of the data layer (in-memory, seeded).
  Same async interface as ./supabase so pages never know the difference.
*/

import type {
  FeedItemView,
  MatchView,
  MessageView,
  SessionUser,
  ThreadView,
  Tier,
  Track,
  TrackKind,
} from "@/lib/types";
import {
  cancelSubscription as storeCancelSubscription,
  createDemoTrack,
  db,
  expressInterest as storeExpressInterest,
  markThreadRead as storeMarkThreadRead,
  matchesForDemoTrack,
  matchesForTalent,
  passMatch as storePassMatch,
  sendMessage as storeSendMessage,
  setSubscription as storeSetSubscription,
  threadsFor,
  tracksFor,
  type DemoMatch,
  type DemoUser,
} from "@/lib/demo/store";
import { obscureName } from "@/lib/demo/seed";
import { creatorCanReveal, hasActiveSub, talentView } from "./shared";

function demoUser(user: SessionUser): DemoUser | null {
  return db().users.get(user.id) ?? null;
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
  const u = demoUser(user);
  if (!u) return null;
  return createDemoTrack(u, input.title, input.kind);
}

export async function deleteTrack(user: SessionUser, trackId: string): Promise<void> {
  const d = db();
  const t = d.tracks.get(trackId);
  if (!t || t.ownerId !== user.id) return;
  for (const m of Array.from(d.matches.values())) {
    if (m.demoTrackId === trackId) d.matches.delete(m.id);
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
    talent: talentView(revealed, talent, m.id),
    interested: m.interestedBy.has(user.id),
    mutual: m.mutual,
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
    demo: revealed
      ? {
          title: track.title,
          durationSec: track.durationSec,
          seed: track.seed,
          creatorName: creator?.displayName ?? "Unknown creator",
          genres: creator?.genres ?? [],
        }
      : {
          title: obscureName(m.id + ":t"),
          durationSec: track.durationSec,
          seed: track.seed,
          creatorName: obscureName(m.id + ":c"),
          genres: creator?.genres ?? [],
        },
  };
}

export async function getFeed(user: SessionUser): Promise<FeedItemView[]> {
  return matchesForTalent(user.id)
    .filter((m) => !m.interestedBy.has(user.id) && !m.passedBy.has(user.id))
    .map((m) => toFeedItem(user, m));
}

export async function countFeed(user: SessionUser): Promise<number> {
  return matchesForTalent(user.id).filter(
    (m) => !m.interestedBy.has(user.id) && !m.passedBy.has(user.id)
  ).length;
}

/* ---- interest --------------------------------------------------------- */

export async function expressInterest(
  user: SessionUser,
  matchId: string
): Promise<{ mutual: boolean; threadId?: string }> {
  const u = demoUser(user);
  if (!u) return { mutual: false };
  return storeExpressInterest(u, matchId);
}

export async function passMatch(user: SessionUser, matchId: string): Promise<void> {
  const u = demoUser(user);
  if (u) storePassMatch(u, matchId);
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
  const u = demoUser(user);
  if (u) storeSendMessage(u, threadId, body);
}

export async function markThreadRead(user: SessionUser, threadId: string): Promise<void> {
  const u = demoUser(user);
  if (u) storeMarkThreadRead(u, threadId);
}

/* ---- billing ---------------------------------------------------------- */

export async function setSubscription(user: SessionUser, tier: Tier): Promise<void> {
  const u = demoUser(user);
  if (u) storeSetSubscription(u, tier);
}

export async function cancelSubscription(user: SessionUser): Promise<void> {
  const u = demoUser(user);
  if (u) storeCancelSubscription(u);
}
