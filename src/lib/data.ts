/*
  Read layer with server-enforced gating.

  Every view model built here is redacted BEFORE it leaves the server:
  unsubscribed viewers never receive real names, contacts, or profile ids —
  only counts, similarity scores, and obscured stand-ins. The CSS blur on
  the client is presentation; the redaction here is the security boundary.
*/

import type {
  FeedItemView,
  MatchView,
  MessageView,
  SessionUser,
  ThreadView,
  Track,
} from "@/lib/types";
import { tierCoversProducers, tierCoversRole } from "@/lib/types";
import {
  db,
  matchesForDemoTrack,
  matchesForTalent,
  threadsFor,
  tracksFor,
  type DemoMatch,
} from "@/lib/demo/store";
import { obscureName } from "@/lib/demo/seed";

function hasActiveSub(user: SessionUser): boolean {
  return user.subscription?.status === "active" && tierCoversRole(user.subscription.tier, user.role);
}

/** Can this creator reveal a match against this talent role? */
function creatorCanReveal(user: SessionUser, talentRole: "artist" | "producer"): boolean {
  if (!hasActiveSub(user)) return false;
  if (talentRole === "producer") return tierCoversProducers(user.subscription!.tier);
  return true;
}

export function getTracks(user: SessionUser): Track[] {
  return tracksFor(user.id);
}

export function getTrack(user: SessionUser, trackId: string): Track | null {
  const t = db().tracks.get(trackId);
  if (!t || t.ownerId !== user.id) return null;
  return t;
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
    talent: revealed
      ? {
          role: talent.role,
          displayName: talent.displayName,
          location: talent.location,
          genres: talent.genres,
          craft: talent.craft,
          bio: talent.bio,
          avatarSeed: talent.avatarSeed,
          profileId: talent.id,
        }
      : {
          role: talent.role,
          displayName: obscureName(m.id),
          location: talent.location.split(",").pop()?.trim() ?? "",
          genres: talent.genres,
          craft: talent.craft,
          bio: "",
          avatarSeed: talent.avatarSeed,
          profileId: null,
        },
    interested: m.interestedBy.has(user.id),
    mutual: m.mutual,
  };
}

export function getMatchesForTrack(user: SessionUser, trackId: string): MatchView[] {
  const track = getTrack(user, trackId);
  if (!track) return [];
  return matchesForDemoTrack(trackId).map((m) => toMatchView(user, m));
}

export function countMatchesForTrack(trackId: string): { artists: number; producers: number } {
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

/** Untriaged demos for the swipe feed (newest strong matches first). */
export function getFeed(user: SessionUser): FeedItemView[] {
  return matchesForTalent(user.id)
    .filter((m) => !m.interestedBy.has(user.id) && !m.passedBy.has(user.id))
    .map((m) => toFeedItem(user, m));
}

export function countFeed(user: SessionUser): number {
  return matchesForTalent(user.id).filter(
    (m) => !m.interestedBy.has(user.id) && !m.passedBy.has(user.id)
  ).length;
}

/* ---- inbox ------------------------------------------------------------ */

export function getThreads(user: SessionUser): ThreadView[] {
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
      demoTitle: demo?.title ?? "Demo",
      avatarSeed: other?.avatarSeed ?? 1,
      lastMessage: last?.body ?? null,
      lastMessageAt: last?.sentAt ?? null,
      unread: Boolean(last && last.senderId !== user.id && (!readAt || readAt < last.sentAt)),
    };
  });
}

export function getThread(
  user: SessionUser,
  threadId: string
): { meta: ThreadView; messages: MessageView[] } | null {
  const t = db().threads.get(threadId);
  if (!t || !t.participantIds.includes(user.id)) return null;
  const meta = getThreads(user).find((x) => x.id === threadId)!;
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

export function countUnread(user: SessionUser): number {
  return getThreads(user).filter((t) => t.unread).length;
}

/** Lapsed subscribers keep their inbox, read-only. */
export function inboxWritable(user: SessionUser): boolean {
  return user.subscription?.status === "active";
}
