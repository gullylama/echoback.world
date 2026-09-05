/*
  Supabase implementation of the data layer — real accounts, persistent
  uploads, matches, requests and conversations. Queries run server-side with
  the service client; all pay-to-reveal gating and redaction happens in code
  here (clients have no direct read policies on matches/fingerprints).
*/

import { createHash } from "crypto";
import type {
  FeedItemView,
  FeedQuery,
  MatchView,
  MessageView,
  Profile,
  ProfileEdit,
  ProfileView,
  RequestState,
  RequestSummary,
  RequestView,
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
import { canInitiate, creatorCanReveal, hasActiveSub, talentView } from "./shared";

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

const PROFILE_COLS = "id, role, display_name, location, bio, genres, craft";
const TRACK_COLS = "id, owner_id, kind, title, duration_sec, created_at, status, consent_confirmed";
const MATCH_COLS = "id, demo_track_id, talent_track_id, vocal_score, style_score, production_score, blended_score, created_at";

function scoresOf(r: any) {
  return {
    vocal: r.vocal_score,
    style: r.style_score,
    production: r.production_score,
    blended: r.blended_score,
  };
}

/* ---- tracks ----------------------------------------------------------- */

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
  await svc.from("tracks").delete().eq("id", data.id); // cascades to fingerprints, matches, requests
}

/* ---- requests (shared helpers) ---------------------------------------- */

interface RequestRow {
  id: string;
  match_id: string;
  sender_id: string;
  recipient_id: string;
  state: RequestState;
  note: string | null;
  created_at: string;
}

async function requestsByMatch(matchIds: string[]): Promise<Map<string, RequestRow>> {
  const map = new Map<string, RequestRow>();
  if (matchIds.length === 0) return map;
  const { data } = await serviceClient()
    .from("requests")
    .select("id, match_id, sender_id, recipient_id, state, note, created_at")
    .in("match_id", matchIds);
  for (const r of (data ?? []) as RequestRow[]) map.set(r.match_id, r);
  return map;
}

async function threadIdsByMatch(matchIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (matchIds.length === 0) return map;
  const { data } = await serviceClient()
    .from("threads")
    .select("id, match_id")
    .in("match_id", matchIds);
  for (const t of data ?? []) map.set(t.match_id, t.id);
  return map;
}

function summarise(
  row: RequestRow | undefined,
  viewerId: string,
  threadId: string | null
): RequestSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    state: row.state,
    mine: row.sender_id === viewerId,
    threadId: row.state === "accepted" ? threadId : null,
  };
}

/* ---- creator side ----------------------------------------------------- */

export async function getMatchesForTrack(user: SessionUser, trackId: string): Promise<MatchView[]> {
  const track = await getTrack(user, trackId);
  if (!track) return [];
  const { data } = await serviceClient()
    .from("matches")
    .select(`${MATCH_COLS}, talent:profiles!matches_talent_profile_id_fkey(${PROFILE_COLS})`)
    .eq("demo_track_id", trackId)
    .order("blended_score", { ascending: false });
  const rows = data ?? [];
  const ids = rows.map((r: any) => r.id);
  const [requests, threads] = await Promise.all([requestsByMatch(ids), threadIdsByMatch(ids)]);

  return rows.map((r: any) => {
    const talent = mapProfile(one(r.talent));
    const revealed = creatorCanReveal(user, talent.role as "artist" | "producer");
    return {
      id: r.id,
      demoTrackId: r.demo_track_id,
      scores: scoresOf(r),
      revealed,
      // The voice is audible before paying — reaching it is what costs.
      previewSeed: hashString(r.talent_track_id ?? talent.id),
      talent: talentView(revealed, talent, r.id),
      request: summarise(requests.get(r.id), user.id, threads.get(r.id) ?? null),
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
      `${MATCH_COLS}, demo:tracks!matches_demo_track_id_fkey(id, title, duration_sec, created_at, status, owner:profiles!tracks_owner_id_fkey(id, display_name, genres))`
    )
    .eq("talent_profile_id", user.id)
    .order("blended_score", { ascending: false });
  const rows = (data ?? []).filter((r: any) => one<any>(r.demo)?.status === "fingerprinted");

  const ids = rows.map((r: any) => r.id);
  const [requests, { data: passed }] = await Promise.all([
    requestsByMatch(ids),
    ids.length
      ? serviceClient()
          .from("interests")
          .select("match_id")
          .eq("profile_id", user.id)
          .eq("state", "passed")
          .in("match_id", ids)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const passedSet = new Set((passed ?? []).map((p: any) => p.match_id));
  // Untriaged: nothing dismissed, and no request opened on the pairing yet.
  return rows.filter((r: any) => !passedSet.has(r.id) && !requests.has(r.id));
}

function toFeedItem(user: SessionUser, r: any, revealed: boolean): FeedItemView {
  const demo = one<any>(r.demo);
  const owner = one<any>(demo?.owner);
  return {
    id: r.id,
    scores: scoresOf(r),
    revealed,
    createdAt: demo?.created_at ?? r.created_at,
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
          // decoy waveform only — unrevealed feed items are not playable
          seed: hashString(r.id + ":shape"),
          creatorName: obscureName(r.id + ":c"),
          genres: owner?.genres ?? [],
        },
    request: null, // feed only contains pairings with no request yet
  };
}

export async function getFeed(user: SessionUser, query: FeedQuery = {}): Promise<FeedItemView[]> {
  const revealed = hasActiveSub(user);
  let items = (await feedRows(user)).map((r) => toFeedItem(user, r, revealed));

  if (query.genre) items = items.filter((i) => i.demo.genres.includes(query.genre!));
  if (query.q && query.q.trim()) {
    const needle = query.q.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.demo.title.toLowerCase().includes(needle) ||
        i.demo.creatorName.toLowerCase().includes(needle)
    );
  }
  if (query.sort === "newest") items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else items.sort((a, b) => b.scores.blended - a.scores.blended);
  return items;
}

export async function countFeed(user: SessionUser): Promise<number> {
  return (await feedRows(user)).length;
}

export async function feedGenres(user: SessionUser): Promise<string[]> {
  const set = new Set<string>();
  for (const r of await feedRows(user)) {
    const owner = one<any>(one<any>(r.demo)?.owner);
    for (const g of owner?.genres ?? []) set.add(g);
  }
  return Array.from(set).sort();
}

/* ---- requests --------------------------------------------------------- */

async function partiesFor(matchId: string): Promise<{ creatorId: string; talentId: string } | null> {
  const { data } = await serviceClient()
    .from("matches")
    .select("id, talent_profile_id, demo:tracks!matches_demo_track_id_fkey(owner_id)")
    .eq("id", matchId)
    .maybeSingle();
  if (!data) return null;
  const creatorId = one<any>(data.demo)?.owner_id;
  if (!creatorId) return null;
  return { creatorId, talentId: data.talent_profile_id };
}

export async function sendRequest(
  user: SessionUser,
  matchId: string,
  note: string | null
): Promise<{ ok: boolean; state?: string; threadId?: string | null; reason?: string }> {
  const svc = serviceClient();
  const parties = await partiesFor(matchId);
  if (!parties) return { ok: false, reason: "not_found" };
  if (user.id !== parties.creatorId && user.id !== parties.talentId) {
    return { ok: false, reason: "not_found" };
  }
  const recipientId = user.id === parties.creatorId ? parties.talentId : parties.creatorId;

  const { data: counterparty } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", recipientId)
    .maybeSingle();
  if (!counterparty) return { ok: false, reason: "not_found" };
  if (!canInitiate(user, counterparty.role as UserRole)) return { ok: false, reason: "subscription" };

  // One request per pairing — a match can never be pestered twice.
  const { data: existing } = await svc
    .from("requests")
    .select("id, state")
    .eq("match_id", matchId)
    .maybeSingle();
  if (existing) {
    const threads = await threadIdsByMatch([matchId]);
    return { ok: true, state: existing.state, threadId: threads.get(matchId) ?? null };
  }

  const { error } = await svc.from("requests").insert({
    match_id: matchId,
    sender_id: user.id,
    recipient_id: recipientId,
    state: "pending",
    note,
  });
  if (error) return { ok: false, reason: "not_found" };
  return { ok: true, state: "pending", threadId: null };
}

export async function respondToRequest(
  user: SessionUser,
  requestId: string,
  accept: boolean
): Promise<string | null> {
  const svc = serviceClient();
  const { data: request } = await svc
    .from("requests")
    .select("id, match_id, sender_id, recipient_id, state")
    .eq("id", requestId)
    .maybeSingle();
  if (!request || request.recipient_id !== user.id || request.state !== "pending") return null;

  if (!accept) {
    await svc
      .from("requests")
      .update({ state: "declined", responded_at: new Date().toISOString() })
      .eq("id", requestId);
    return null;
  }

  const parties = await partiesFor(request.match_id);
  if (!parties) return null;

  const { data: existingThread } = await svc
    .from("threads")
    .select("id")
    .eq("match_id", request.match_id)
    .maybeSingle();
  let threadId = existingThread?.id ?? null;
  if (!threadId) {
    const { data: thread } = await svc
      .from("threads")
      .insert({
        match_id: request.match_id,
        creator_id: parties.creatorId,
        talent_id: parties.talentId,
      })
      .select("id")
      .single();
    threadId = thread?.id ?? null;
  }
  await svc
    .from("requests")
    .update({ state: "accepted", responded_at: new Date().toISOString() })
    .eq("id", requestId);
  return threadId;
}

export async function passMatch(user: SessionUser, matchId: string): Promise<void> {
  await serviceClient()
    .from("interests")
    .upsert(
      { match_id: matchId, profile_id: user.id, state: "passed" },
      { onConflict: "match_id,profile_id" }
    );
}

export async function getRequests(user: SessionUser): Promise<RequestView[]> {
  const { data } = await serviceClient()
    .from("requests")
    .select(
      `id, match_id, sender_id, recipient_id, state, note, created_at,
       sender:profiles!requests_sender_id_fkey(${PROFILE_COLS}),
       recipient:profiles!requests_recipient_id_fkey(${PROFILE_COLS}),
       match:matches!requests_match_id_fkey(vocal_score, style_score, production_score, blended_score,
         demo:tracks!matches_demo_track_id_fkey(id, title, duration_sec))`
    )
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const rows = data ?? [];
  const threads = await threadIdsByMatch(rows.map((r: any) => r.match_id));

  return rows
    .map((r: any): RequestView | null => {
      const incoming = r.recipient_id === user.id;
      const other = mapProfile(one(incoming ? r.sender : r.recipient));
      const match = one<any>(r.match);
      const demo = one<any>(match?.demo);
      if (!other || !match || !demo) return null;
      return {
        id: r.id,
        matchId: r.match_id,
        incoming,
        state: r.state,
        note: r.note,
        sentAt: r.created_at,
        threadId: r.state === "accepted" ? (threads.get(r.match_id) ?? null) : null,
        scores: scoresOf(match),
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
        track: {
          title: demo.title,
          seed: hashString(demo.id),
          durationSec: demo.duration_sec ?? 0,
        },
      };
    })
    .filter((r): r is RequestView => r !== null);
}

export async function countPendingRequests(user: SessionUser): Promise<number> {
  const { count } = await serviceClient()
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("state", "pending");
  return count ?? 0;
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
      otherPartyId: other?.id ?? "",
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

/* ---- profiles ---------------------------------------------------------- */

export async function updateProfile(user: SessionUser, edit: ProfileEdit): Promise<void> {
  await serviceClient()
    .from("profiles")
    .update({
      display_name: edit.displayName,
      location: edit.location,
      bio: edit.bio,
      genres: edit.genres,
      craft: edit.craft,
    })
    .eq("id", user.id);
}

async function buildProfileView(profileId: string): Promise<ProfileView | null> {
  const svc = serviceClient();
  const { data } = await svc
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return null;
  const profile = mapProfile(data);

  const { data: refs } = await svc
    .from("tracks")
    .select("id, kind")
    .eq("owner_id", profileId)
    .in("kind", ["voice", "production"])
    .order("created_at", { ascending: false });
  const first = (refs ?? [])[0];

  return {
    id: profile.id,
    role: profile.role,
    displayName: profile.displayName,
    location: profile.location,
    bio: profile.bio,
    genres: profile.genres,
    craft: profile.craft,
    avatarSeed: profile.avatarSeed,
    previewSeed: first ? hashString(first.id) : null,
    referenceCount: (refs ?? []).length,
  };
}

export async function getOwnProfile(user: SessionUser): Promise<ProfileView | null> {
  return buildProfileView(user.id);
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
  const svc = serviceClient();

  const { data: thread } = await svc
    .from("threads")
    .select("id")
    .or(
      `and(creator_id.eq.${user.id},talent_id.eq.${profileId}),and(creator_id.eq.${profileId},talent_id.eq.${user.id})`
    )
    .maybeSingle();
  if (thread) return buildProfileView(profileId);

  const { data: request } = await svc
    .from("requests")
    .select("id")
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${profileId}),and(sender_id.eq.${profileId},recipient_id.eq.${user.id})`
    )
    .maybeSingle();
  if (request) return buildProfileView(profileId);

  const { data: target } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!target) return null;

  if (user.role === "creator") {
    if (target.role === "creator") return null;
    if (!creatorCanReveal(user, target.role as "artist" | "producer")) return null;
    const { data: mine } = await svc.from("tracks").select("id").eq("owner_id", user.id);
    const ids = (mine ?? []).map((t: any) => t.id);
    if (ids.length === 0) return null;
    const { data: match } = await svc
      .from("matches")
      .select("id")
      .eq("talent_profile_id", profileId)
      .in("demo_track_id", ids)
      .maybeSingle();
    return match ? buildProfileView(profileId) : null;
  }

  if (!hasActiveSub(user)) return null;
  const { data: theirs } = await svc.from("tracks").select("id").eq("owner_id", profileId);
  const ids = (theirs ?? []).map((t: any) => t.id);
  if (ids.length === 0) return null;
  const { data: match } = await svc
    .from("matches")
    .select("id")
    .eq("talent_profile_id", user.id)
    .in("demo_track_id", ids)
    .maybeSingle();
  return match ? buildProfileView(profileId) : null;
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
