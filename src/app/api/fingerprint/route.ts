import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/config";

/*
  Callback endpoint for the GPU fingerprint worker (worker/fingerprint.py).

  The worker downloads a newly-uploaded audio file from Supabase Storage,
  produces the three component embeddings (vocal / style / production) and
  POSTs them here. This route stores the vectors and refreshes cached
  matches via the `match_track` SQL function (see supabase/migrations).

  Auth: shared secret in the FINGERPRINT_WORKER_SECRET env var.
*/

interface FingerprintPayload {
  trackId: string;
  contentHash: string;
  vocal: number[];
  style: number[];
  production: number[];
  /** written by the worker so previews are a real clip, not a byte range */
  previewPath?: string | null;
  /** backfilled when the browser could not decode the file at upload */
  durationSec?: number | null;
  byteSize?: number | null;
  peaks?: number[] | null;
}

export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "storage not configured" }, { status: 501 });
  }
  const secret = process.env.FINGERPRINT_WORKER_SECRET;
  if (!secret || req.headers.get("x-worker-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as FingerprintPayload;
  if (!body.trackId || !body.vocal || !body.style || !body.production) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { serviceClient } = await import("@/lib/supabase/service");
  const supabase = serviceClient();

  const { error: fpError } = await supabase.from("fingerprints").upsert(
    {
      track_id: body.trackId,
      content_hash: body.contentHash,
      vocal_vector: body.vocal,
      style_vector: body.style,
      production_vector: body.production,
    },
    { onConflict: "track_id" }
  );
  if (fpError) return NextResponse.json({ error: fpError.message }, { status: 500 });

  // Only backfill what the browser could not measure — never overwrite it.
  const { data: existing } = await supabase
    .from("tracks")
    .select("duration_sec, byte_size, peaks")
    .eq("id", body.trackId)
    .maybeSingle();

  const update: Record<string, unknown> = { status: "fingerprinted" };
  if (body.previewPath) update.preview_path = body.previewPath;
  if (!existing?.duration_sec && body.durationSec) {
    update.duration_sec = Math.round(body.durationSec);
  }
  if (!existing?.byte_size && body.byteSize) update.byte_size = body.byteSize;
  if (!existing?.peaks?.length && body.peaks?.length) {
    update.peaks = body.peaks
      .slice(0, 400)
      .map((p) => Math.max(0, Math.min(1000, Math.round(p))));
  }

  await supabase.from("tracks").update(update).eq("id", body.trackId);

  // Recompute cached matches for this track (both directions).
  const { error: matchError } = await supabase.rpc("refresh_matches_for_track", {
    p_track_id: body.trackId,
  });
  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
