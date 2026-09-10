/*
  Who may hear what.

  Playback never hands out a storage URL. Every request goes through
  /api/audio/[trackId], which resolves access here on each hit — so a
  cancelled subscription or a declined request takes effect immediately
  rather than when a signed link happens to expire.

    full     the whole file: your own upload, or you are in a request or a
             conversation with the other side (you cannot judge what you
             cannot hear, and answering is always free)
    preview  a capped opening slice: this track matched you, and hearing is
             free — identity and outreach are what cost
    none     no relationship: 403
*/

import type { SessionUser } from "@/lib/types";
import { hasActiveSub } from "@/lib/data/shared";

export type AudioAccess = "full" | "preview" | "none";

export const PREVIEW_SECONDS = 30;
/** Fallback cap when duration or size is unknown (~30s of 256kbps audio). */
export const PREVIEW_FALLBACK_BYTES = 960_000;

export interface ResolvedAudio {
  access: AudioAccess;
  storagePath: string | null;
  /** a real clip written by the worker, served whole when present */
  previewPath: string | null;
  byteSize: number | null;
  durationSec: number | null;
  contentType: string;
}

const DENIED: ResolvedAudio = {
  access: "none",
  storagePath: null,
  previewPath: null,
  byteSize: null,
  durationSec: null,
  contentType: "application/octet-stream",
};

export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "wav") return "audio/wav";
  if (ext === "m4a" || ext === "mp4") return "audio/mp4";
  if (ext === "ogg" || ext === "oga") return "audio/ogg";
  if (ext === "flac") return "audio/flac";
  return "audio/mpeg";
}

/** How many bytes of the opening constitute a preview. */
export function previewByteCap(byteSize: number | null, durationSec: number | null): number {
  if (!byteSize || byteSize <= 0) return PREVIEW_FALLBACK_BYTES;
  if (!durationSec || durationSec <= PREVIEW_SECONDS) return byteSize;
  const perSecond = byteSize / durationSec;
  return Math.min(byteSize, Math.ceil(perSecond * PREVIEW_SECONDS));
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function resolveAudioAccess(
  user: SessionUser,
  trackId: string
): Promise<ResolvedAudio> {
  const { serviceClient } = await import("@/lib/supabase/service");
  const svc = serviceClient();

  const { data: track } = await svc
    .from("tracks")
    .select("id, owner_id, kind, storage_path, preview_path, byte_size, duration_sec")
    .eq("id", trackId)
    .maybeSingle();
  if (!track || !track.storage_path) return DENIED;

  const resolved: Omit<ResolvedAudio, "access"> = {
    storagePath: track.storage_path,
    previewPath: track.preview_path ?? null,
    byteSize: track.byte_size ?? null,
    durationSec: track.duration_sec ?? null,
    contentType: contentTypeFor(track.storage_path),
  };

  if (track.owner_id === user.id) return { ...resolved, access: "full" };

  // Which matches connect this track to this viewer?
  const isDemo = track.kind === "demo";
  let matchIds: string[] = [];

  if (isDemo) {
    const { data } = await svc
      .from("matches")
      .select("id")
      .eq("demo_track_id", trackId)
      .eq("talent_profile_id", user.id);
    matchIds = (data ?? []).map((m: any) => m.id);
  } else {
    const { data } = await svc
      .from("matches")
      .select("id, demo:tracks!matches_demo_track_id_fkey(owner_id)")
      .eq("talent_track_id", trackId);
    matchIds = (data ?? [])
      .filter((m: any) => {
        const demo = Array.isArray(m.demo) ? m.demo[0] : m.demo;
        return demo?.owner_id === user.id;
      })
      .map((m: any) => m.id);
  }

  if (matchIds.length === 0) return DENIED;

  // A request in either direction means both sides need to hear it properly.
  const { data: request } = await svc
    .from("requests")
    .select("id")
    .in("match_id", matchIds)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();
  if (request) return { ...resolved, access: "full" };

  // Otherwise: a preview. Creators may always hear the talent they matched —
  // that is the point of the paywall. Talent must be subscribed to browse.
  if (isDemo) {
    return hasActiveSub(user) ? { ...resolved, access: "preview" } : DENIED;
  }
  return { ...resolved, access: "preview" };
}
