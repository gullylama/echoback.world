/*
  Supabase implementation of the data layer — real accounts, persistent
  uploads, matches and conversations. Queries run server-side with the
  service client; all pay-to-reveal gating and redaction happens in code
  here (clients have no direct read policies on matches/fingerprints).
*/

import { createHash } from "crypto";
import type {
  FeedItemView,
  MatchView,
  MessageView,
  Profile,
  SessionUser,
  Subscription,
  ThreadView,
  Tier,
  Track,
  TrackKind,
  UserRole,
} from "@/lib/types";
import { hashString, obscureName } from "@/lib/demo/seed";
import { serviceClient } from "@/lib/supabase/service";
import { stripeConfigured } from "@/lib/config";
import { creatorCanReveal, hasActiveSub, talentView } from "./shared";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** PostgREST returns to-one embeds as object or single-element array. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    role: row.role as UserRole,
    displayName: row.display_name,
    location: row.location ?? "",
    bio: row.bio ?? "",
    genres: row.genres ?? [],
    craft: row.craft ?? "",
    avatarSeed: hashString(row.id) % 97,
  };
}

function mapTrack(row: any): Track {
  const status =
    row.status === "fingerprinted" ? "fingerprinted" : row.status === "failed" ? "failed" : "processing";
  return {
    id: row.id,
    ownerId: row.owner_id,
    kind: row.kind as TrackKind,
    title: row.title,
    durationSec: row.duration_sec ?? 0,
    createdAt: row.created_at,
    seed: hashString(row.id),
    status,
    consentConfirmed: Boolean(row.consent_confirmed),
  };
}

/* ---- tracks ----------------------------------------------------------- */

const TRACK_COLS = "id, owner_id, kind, title, duration_sec, created_at, status, consent_confirmed";

export async function getTracks(user: SessionUser): Promise<Track[]> {
  const { data } = await serviceClient()
    .from("tracks")
    .select(TRACK_COLS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapTrack);
}

export async function getTrack(user: SessionUser, trackId: string): Promise<Track | null> {
  const { data } = await serviceClient()
    .from("tracks")
    .select(TRACK_COLS)
    .eq("id", trackId)
    .eq("owner_id", user.id)
    .maybeSingle();
  return data ? mapTrack(data) : null;
}

const AUDIO_BUCKET = "audio";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function createTrack(
  user: SessionUser,
  input: { title: string; kind: TrackKind; file?: File | null }
): Promise<Track | null> {
  const file = input.file;
  if (!file || file.size === 0 || file.size > MAX_UPLOAD_BYTES) return null;

  const svc = serviceClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(buffer).digest("hex");

  // Idempotent fingerprinting: same file from the same owner dedupes.
  const { data: existing } = await svc
    .from("tracks")
    .select(TRACK_COLS)
    .eq("owner_id", user.id)
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (existing) return mapTrack(existing);

  const ext = (file.name.split(".").pop() || "mp3").toLowerCase().slice(0, 5);
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await svc.storage.from(AUDIO_BUCKET).upload(path, buffer, {
    contentType: file.type || "audio/mpeg",
  });
  if (upErr) return null;

  const { data, error } = await svc
    .from("tracks")
    .insert({
      owner_id: user.id,
      kind: input.kind,
      title: input.title,
      storage_path: path,
      content_hash: contentHash,
      status: "uploaded",
      consent_confirmed: true,
      rights_confirmed: true,
    })
    .select(TRACK_COLS)
    .single();
  if (error || !data) return null;
  return mapTrack(data);
}

export async function deleteTrack(user: SessionUser, trackId: string): Promise<void> {
  const svc = serviceClient();
  const { data } = await svc
    .from("tracks")
    .select("id, storage_path")
    .eq("id", trackId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return;
  if (data.storage_path) await svc.storage.from(AUDIO_BUCKET).remove([data.storage_path]);
  await svc.from("tracks").delete().eq("id", data.id); // cascades to fingerprints + matches
}

/* ---- creator side ----------------------------------------------------- */

const MATCH_COLS =
  "id, demo_track_id, vocal_score, style_score, production_score, blended_score";

async function interestSets(matchIds: string[]) {
  if (matchIds.length === 0) return new Map<string, { profileId: string; state: string }[]>();
  const { data } = await serviceClient()
    .from("interests")
    .select("match_id, profile_id, state")
    .in("match_id", matchIds);
  const map = new Map<string, { profileId: string; state: string }[]>();
  for (const r of data ?? []) {
    const list = map.get(r.match_id) ?? [];
    list.push({ profileId: r.profile_id, state: r.state });
    map.set(r.match_id, list);
  }
  return map;
}

export async function getMatchesForTrack(user: SessionUser, trackId: string): Promise<MatchView[]> {
  const track = await getTrack(user, trackId);
  if (!track) return [];
  const { data } = await serviceClient()
    .from("matches")
    .select(
      `${MATCH_COLS}, talent:profiles!matches_talent_profile_id_fkey(id, role, display_name, location, bio, genres, craft)`
    )
    .eq("demo_track_id", trackId)
    .order("blended_score", { ascending: false });
  const rows = data ?? [];
  const interests = await interestSets(rows.map((r: any) => r.id));

  return rows.map((r: any) => {
    const talent = mapProfile(one(r.talent));
    const revealed = creatorCanReveal(user, talent.role as "artist" | "producer");
    const ints = interests.get(r.id) ?? [];
    const mine = ints.some((i) => i.profileId === user.id && i.state === "interested");
    const theirs = ints.some((i) => i.profileId === talent.id && i.state === "interested");
    return {
      id: r.id,
      demoTrackId: r.demo_track_id,
      scores: {
        vocal: r.vocal_score,
        style: r.style_score,
        production: r.production_score,
        blended: r.blended_score,
      },
      revealed,
      talent: talentView(revealed, talent, r.id),
      interested: mine,
      mutual: mine && theirs,
    };
  });
}

export async function countMatchesForTrack(
  user: SessionUser,
  trackId: string
): Promise<{ artists: number; producers: number }> {
  const track = await getTrack(user, trackId);
  if (!track) return { artists: 0, producers: 0 };
  const { data } = await serviceClient()
    .from("matches")
    .select("id, talent:profiles!matches_talent_profile_id_fkey(role)")
    .eq("demo_track_id", trackId);
  const rows = data ?? [];
  return {
    artists: rows.filter((r: any) => one<any>(r.talent)?.role === "artist").length,
    producers: rows.filter((r: any) => one<any>(r.talent)?.role === "producer").length,
  };
}

/* ---- talent side ------------------------------------------------------ */

async function feedRows(user: SessionUser) {
  const { data } = await serviceClient()
    .from("matches")
    .select(
      `${MATCH_COLS}, demo:tracks!matches_demo_track_id_fkey(id, title, duration_sec, status, owner:profiles!tracks_owner_id_fkey(display_name, genres))`
    )
    .eq("talent_profile_id", user.id)
    .order("blended_score", { ascending: false });
  const rows = (data ?? []).filter((r: any) => one<any>(r.demo)?.status === "fingerprinted");
  const interests = await interestSets(rows.map((r: any) => r.id));
  return rows.filter(
    (r: any) => !(interests.get(r.id) ?? []).some((i) => i.profileId === user.id)
  );
}

export async function getFeed(user: SessionUser): Promise<FeedItemView[]> {
  const rows = await feedRows(user);
  const revealed = hasActiveSub(user);
  return rows.map((r: any) => {
    const demo = one<any>(r.demo);
    const owner = one<any>(demo?.owner);
    return {
      id: r.id,
      scores: {
        vocal: r.vocal_score,
        style: r.style_score,
        production: r.production_score,
        blended: r.blended_score,
      },
      revealed,
      demo: revealed
        ? {
            title: demo?.title ?? "Track",
            durationSec: demo?.duration_sec ?? 0,
            seed: hashString(demo?.id ?? r.id),
            creatorName: owner?.display_name ?? "Creator",
            genres: owner?.genres ?? [],
          }
        : {
            title: obscureName(r.id + ":t"),
            durationSec: demo?.duration_sec ?? 0,
            seed: hashString(demo?.id ?? r.id),
            creatorName: obscureName(r.id + ":c"),
            genres: owner?.genres ?? [],
          },
    };
  });
}

export async function countFeed(user: SessionUser): Promise<number> {
  return (await feedRows(user)).length;
}

/* ---- interest --------------------------------------------------------- */

export async function expressInterest(
  user: SessionUser,
  matchId: string
): Promise<{ mutual: boolean; threadId?: string }> {
  const svc = serviceClient();
  const { data: match } = await svc
    .from("matches")
    .select("id, talent_profile_id, demo:tracks!matches_demo_track_id_fkey(owner_id)")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { mutual: false };

  const creatorId = one<any>(match.demo)?.owner_id as string;
  const talentId = match.talent_profile_id as string;
  if (user.id !== creatorId && user.id !== talentId) return { mutual: false };
  const counterpartId = user.id === creatorId ? talentId : creatorId;

  await svc
    .from("interests")
    .upsert(
      { match_id: matchId, profile_id: user.id, state: "interested" },
      { onConflict: "match_id,profile_id" }
    );

  const { data: theirs } = await svc
    .from("interests")
    .select("state")
    .eq("match_id", matchId)
    .eq("profile_id", counterpartId)
    .eq("state", "interested")
    .maybeSingle();
  if (!theirs) return { mutual: false };

  const { data: existing } = await svc
    .from("threads")
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (existing) return { mutual: true, threadId: existing.id };

  const { data: thread } = await svc
    .from("threads")
    .insert({ match_id: matchId, creator_id: creatorId, talent_id: talentId })
    .select("id")
    .single();
  return { mutual: true, threadId: thread?.id };
}

export async function passMatch(user: SessionUser, matchId: string): Promise<void> {
  await serviceClient()
    .from("interests")
    .upsert(
      { match_id: matchId, profile_id: user.id, state: "passed" },
      { onConflict: "match_id,profile_id" }
    );
}

/* ---- inbox ------------------------------------------------------------ */

async function threadRowsFor(user: SessionUser) {
  const { data } = await serviceClient()
    .from("threads")
    .select(
      `id, match_id, creator_id, talent_id,
       creator:profiles!threads_creator_id_fkey(id, role, display_name),
       talent:profiles!threads_talent_id_fkey(id, role, display_name),
       match:matches!threads_match_id_fkey(demo:tracks!matches_demo_track_id_fkey(title))`
    )
    .or(`creator_id.eq.${user.id},talent_id.eq.${user.id}`);
  return data ?? [];
}

export async function getThreads(user: SessionUser): Promise<ThreadView[]> {
  const svc = serviceClient();
  const rows = await threadRowsFor(user);
  if (rows.length === 0) return [];
  const ids = rows.map((r: any) => r.id);

  const { data: msgs } = await svc
    .from("messages")
    .select("id, thread_id, sender_id, body, sent_at")
    .in("thread_id", ids)
    .order("sent_at", { ascending: false });
  const lastByThread = new Map<string, any>();
  for (const m of msgs ?? []) if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);

  const { data: reads } = await svc
    .from("thread_reads")
    .select("thread_id, read_at")
    .in("thread_id", ids)
    .eq("profile_id", user.id);
  const readByThread = new Map((reads ?? []).map((r: any) => [r.thread_id, r.read_at]));

  const views = rows.map((r: any) => {
    const other = one<any>(r.creator_id === user.id ? r.talent : r.creator);
    const last = lastByThread.get(r.id) ?? null;
    const readAt = readByThread.get(r.id);
    return {
      id: r.id,
      otherPartyName: other?.display_name ?? "Member",
      otherPartyRole: (other?.role ?? "artist") as ThreadView["otherPartyRole"],
      demoTitle: one<any>(one<any>(r.match)?.demo)?.title ?? "Track",
      avatarSeed: other ? hashString(other.id) % 97 : 1,
      lastMessage: last?.body ?? null,
      lastMessageAt: last?.sent_at ?? null,
      unread: Boolean(last && last.sender_id !== user.id && (!readAt || readAt < last.sent_at)),
    };
  });
  return views.sort((a, b) => (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""));
}

export async function getThread(
  user: SessionUser,
  threadId: string
): Promise<{ meta: ThreadView; messages: MessageView[] } | null> {
  const meta = (await getThreads(user)).find((t) => t.id === threadId);
  if (!meta) return null;
  const { data: msgs } = await serviceClient()
    .from("messages")
    .select("id, sender_id, body, sent_at")
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: true });
  return {
    meta,
    messages: (msgs ?? []).map((m: any) => ({
      id: m.id,
      mine: m.sender_id === user.id,
      body: m.body,
      sentAt: m.sent_at,
    })),
  };
}

export async function countUnread(user: SessionUser): Promise<number> {
  return (await getThreads(user)).filter((t) => t.unread).length;
}

export async function sendMessage(user: SessionUser, threadId: string, body: string): Promise<void> {
  const svc = serviceClient();
  const { data: thread } = await svc
    .from("threads")
    .select("id, creator_id, talent_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread || (thread.creator_id !== user.id && thread.talent_id !== user.id)) return;
  await svc.from("messages").insert({ thread_id: threadId, sender_id: user.id, body });
  await markThreadRead(user, threadId);
}

export async function markThreadRead(user: SessionUser, threadId: string): Promise<void> {
  await serviceClient()
    .from("thread_reads")
    .upsert(
      { thread_id: threadId, profile_id: user.id, read_at: new Date().toISOString() },
      { onConflict: "thread_id,profile_id" }
    );
}

/* ---- billing ---------------------------------------------------------- */

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data } = await serviceClient()
    .from("subscriptions")
    .select("tier, status, current_period_end, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const fallback = new Date(data.updated_at ?? Date.now());
  fallback.setMonth(fallback.getMonth() + 1);
  return {
    tier: data.tier as Tier,
    status: data.status as Subscription["status"],
    renewsAt: data.current_period_end ?? fallback.toISOString(),
  };
}

/** Direct grant — used only when Stripe isn't configured (e.g. staging). */
export async function setSubscription(user: SessionUser, tier: Tier): Promise<void> {
  const renews = new Date();
  renews.setMonth(renews.getMonth() + 1);
  await serviceClient()
    .from("subscriptions")
    .upsert(
      {
        user_id: user.id,
        tier,
        status: "active",
        current_period_end: renews.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
}

export async function cancelSubscription(user: SessionUser): Promise<void> {
  const svc = serviceClient();
  const { data } = await svc
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (stripeConfigured && data?.stripe_subscription_id) {
    try {
      const { stripe } = await import("@/lib/stripe");
      await stripe().subscriptions.update(data.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch {
      // fall through — the webhook is the source of truth once Stripe responds
    }
  }
  await svc
    .from("subscriptions")
    .update({ status: "lapsed", updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
}
