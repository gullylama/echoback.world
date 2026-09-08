import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/config";
import type { EmailOtpType } from "@supabase/supabase-js";

/*
  Auth callback. Handles both flows Supabase can send us:

  1. `token_hash` + `type` — email confirmation, password recovery, magic
     links. Verified with verifyOtp, which works even when the link is
     opened on a different device or browser from the one that signed up.
     This is the flow the email templates should use.
  2. `code` — the PKCE exchange used by OAuth (Google). Requires the code
     verifier cookie set on this device, which is fine for OAuth because
     the round trip happens in the same browser.

  Supabase can also redirect here with `error` / `error_description` (an
  expired or already-used link, most often); those are surfaced rather than
  silently dropped.
*/

const OTP_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as string[]).includes(value);
}

/** Only ever redirect to a path on this site — never an attacker's URL. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/studio";
  return raw;
}

function fail(origin: string, message: string) {
  return NextResponse.redirect(
    new URL(`/start?error=${encodeURIComponent(message)}`, origin)
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const next = safeNext(url.searchParams.get("next"));

  const providerError =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    return fail(
      origin,
      /expired|invalid/i.test(providerError)
        ? "That link has expired or already been used. Request a new one below."
        : providerError
    );
  }

  if (!supabaseConfigured) return NextResponse.redirect(new URL(next, origin));

  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      return fail(origin, "That link has expired or already been used. Request a new one below.");
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return fail(
        origin,
        "We couldn't complete that sign-in. Try again in the browser you started in."
      );
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  return fail(origin, "That confirmation link was incomplete. Request a new one below.");
}
