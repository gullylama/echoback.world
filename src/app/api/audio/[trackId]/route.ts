import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/config";
import {
  PREVIEW_SECONDS,
  previewByteCap,
  resolveAudioAccess,
} from "@/lib/audio-access";

/*
  Authorised audio streaming.

  Full access supports byte ranges so the player can seek. Previews
  deliberately do NOT: they are served as a plain 200 of the capped opening
  slice with no Accept-Ranges, so the browser treats that slice as the whole
  file and there is no way to ask for the rest.
*/

export const dynamic = "force-dynamic";

function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === "" && rawEnd === "") return null;
  if (rawStart === "") {
    const len = Number(rawEnd);
    if (!Number.isFinite(len) || len <= 0) return null;
    return { start: Math.max(0, size - len), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Number(rawEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

/** Hard-stop a stream at `limit` bytes, whatever upstream decides to send. */
function truncate(body: ReadableStream<Uint8Array>, limit: number): ReadableStream<Uint8Array> {
  let sent = 0;
  const reader = body.getReader();
  return new ReadableStream({
    async pull(controller) {
      if (sent >= limit) {
        controller.close();
        await reader.cancel().catch(() => {});
        return;
      }
      const { done, value } = await reader.read();
      if (done) return controller.close();
      const room = limit - sent;
      const chunk = value.byteLength > room ? value.subarray(0, room) : value;
      sent += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel(reason) {
      return reader.cancel(reason).catch(() => {});
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trackId: string }> }
) {
  if (!supabaseConfigured) return new NextResponse("Not found", { status: 404 });

  const user = await currentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { trackId } = await params;
  const resolved = await resolveAudioAccess(user, trackId);
  if (resolved.access === "none" || !resolved.storagePath) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const isPreview = resolved.access === "preview";
  // A worker-generated clip is already the right length: serve it whole.
  const usingClip = isPreview && Boolean(resolved.previewPath);
  const objectPath = usingClip ? resolved.previewPath! : resolved.storagePath;

  const { serviceClient } = await import("@/lib/supabase/service");
  const svc = serviceClient();
  const { data: signed, error: signError } = await svc.storage
    .from("audio")
    .createSignedUrl(objectPath, 120);
  if (signError || !signed?.signedUrl) {
    return new NextResponse("Audio unavailable", { status: 502 });
  }

  const headers = new Headers({
    "Content-Type": resolved.contentType,
    "Cache-Control": "private, no-store",
    // Authorisation is per-request; never let a shared cache hold this.
    Vary: "Cookie",
  });

  /* ---- capped preview: one shot, no ranges ---- */
  if (isPreview && !usingClip) {
    const cap = previewByteCap(resolved.byteSize, resolved.durationSec);
    const upstream = await fetch(signed.signedUrl, {
      headers: { Range: `bytes=0-${cap - 1}` },
    });
    if (!upstream.ok && upstream.status !== 206 && upstream.status !== 200) {
      return new NextResponse("Audio unavailable", { status: 502 });
    }
    if (!upstream.body) return new NextResponse("Audio unavailable", { status: 502 });

    // Storage honours the Range, but the cap is the paywall — enforce it here
    // rather than trusting the response, and only claim a Content-Length we
    // can actually deliver, so the browser never waits on bytes that
    // aren't coming.
    const upstreamLength = Number(upstream.headers.get("content-length"));
    const served = Number.isFinite(upstreamLength) && upstreamLength > 0
      ? Math.min(cap, upstreamLength)
      : null;
    if (served !== null) headers.set("Content-Length", String(served));
    headers.set("X-Preview-Seconds", String(PREVIEW_SECONDS));
    return new NextResponse(truncate(upstream.body, served ?? cap), {
      status: 200,
      headers,
    });
  }

  /* ---- full access (or a real clip): support seeking ---- */
  const size = usingClip ? null : resolved.byteSize;
  const range = size ? parseRange(req.headers.get("range"), size) : null;
  headers.set("Accept-Ranges", "bytes");

  const upstream = await fetch(
    signed.signedUrl,
    range ? { headers: { Range: `bytes=${range.start}-${range.end}` } } : undefined
  );
  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse("Audio unavailable", { status: 502 });
  }

  if (range && size) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new NextResponse(upstream.body, { status: 206, headers });
  }

  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new NextResponse(upstream.body, { status: 200, headers });
}
