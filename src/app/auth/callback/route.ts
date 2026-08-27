import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/config";

/*
  OAuth / email-confirmation callback. Supabase redirects here with a
  `code`; we exchange it for a session (cookies are set by the SSR
  client) and land the user in the app. Users without a profile yet
  (first Google sign-in) are routed through onboarding by /start.
*/

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/studio";

  if (supabaseConfigured && code) {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/start?error=${encodeURIComponent("Sign-in failed — please try again.")}`, url.origin)
      );
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
