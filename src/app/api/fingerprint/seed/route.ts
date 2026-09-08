import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/config";
import { placeholderFingerprint } from "@/lib/placeholder-vectors";

/*
  OPERATOR TOOL — proves the live pipeline works before the GPU worker exists.

  Fingerprints pending uploads with deterministic PLACEHOLDER vectors (see
  lib/placeholder-vectors.ts) and refreshes cached matches, so the full loop
  can be walked end to end against the real database. The similarities it
  produces are NOT real match quality.

  Two independent gates, both required:
    1. SEED_FINGERPRINTS must be "1" — absent, the route 404s as if it
       doesn't exist. Remove the variable once the real worker is running.
    2. x-worker-secret must equal FINGERPRINT_WORKER_SECRET.
*/

export const dynamic = "force-dynamic";

const MAX_BATCH = 50;

function enabled(): boolean {
  const flag = process.env.SEED_FINGERPRINTS;
  return flag === "1" || flag === "true";
}

function secretMatches(provided: string | null): boolean {
  const expected = process.env.FINGERPRINT_WORKER_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  // Gate 1 — the route does not exist unless explicitly switched on.
  if (!enabled()) return new NextResponse("Not found", { status: 404 });

  // Gate 2 — same shared secret the real worker uses.
  if (!secretMatches(req.headers.get("x-worker-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!supabaseConfigured) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 501 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 25) || 25, 1),
    MAX_BATCH
  );

  const { serviceClient } = await import("@/lib/supabase/service");
  const supabase = serviceClient();

  const { data: pending, error: listError } = await supabase
    .from("tracks")
    .select("id, title, kind, content_hash")
    .in("status", ["uploaded", "processing", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const done: { id: string; title: string; kind: string }[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const track of pending ?? []) {
    // content_hash is written at upload; fall back to the id so a row with a
    // missing hash still gets a stable vector rather than being skipped.
    const seedKey = track.content_hash || track.id;
    const { vocal, style, production } = placeholderFingerprint(seedKey);

    const { error: fpError } = await supabase.from("fingerprints").upsert(
      {
        track_id: track.id,
        content_hash: seedKey,
        vocal_vector: vocal,
        style_vector: style,
        production_vector: production,
      },
      { onConflict: "track_id" }
    );
    if (fpError) {
      failed.push({ id: track.id, reason: fpError.message });
      continue;
    }

    const { error: statusError } = await supabase
      .from("tracks")
      .update({ status: "fingerprinted" })
      .eq("id", track.id);
    if (statusError) {
      failed.push({ id: track.id, reason: statusError.message });
      continue;
    }

    // Recompute cached matches in both directions for this track.
    const { error: matchError } = await supabase.rpc("refresh_matches_for_track", {
      p_track_id: track.id,
    });
    if (matchError) {
      failed.push({ id: track.id, reason: matchError.message });
      continue;
    }

    done.push({ id: track.id, title: track.title, kind: track.kind });
  }

  return NextResponse.json({
    warning:
      "Placeholder vectors — derived from the file hash, not its audio. Similarities are not real match quality.",
    fingerprinted: done.length,
    failed: failed.length,
    tracks: done,
    errors: failed,
  });
}
