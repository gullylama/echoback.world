"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ProfileEdit, Tier, TrackKind, UserRole } from "@/lib/types";
import { tierCoversRole } from "@/lib/types";
import { createDemoUser } from "@/lib/demo/store";
import {
  clearSessionCookie,
  currentUser,
  getAuthState,
  setSessionCookie,
} from "@/lib/session";
import { stripeConfigured, supabaseConfigured } from "@/lib/config";
import * as data from "@/lib/data";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const VALID_ROLES: UserRole[] = ["creator", "artist", "producer"];

function startError(message: string, mode?: string): never {
  const params = new URLSearchParams({ error: message });
  if (mode) params.set("mode", mode);
  redirect(`/start?${params.toString()}`);
}

/* ---- auth ------------------------------------------------------------- */

export async function signUpAction(formData: FormData) {
  const role = formData.get("role") as UserRole;
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!VALID_ROLES.includes(role) || !name) return;

  if (!supabaseConfigured) {
    const user = createDemoUser(role, name);
    await setSessionCookie(user.id);
    redirect("/studio");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) {
    startError("Enter your email and a password of at least 8 characters.");
  }

  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data: result, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role, display_name: name },
      emailRedirectTo: `${SITE}/auth/callback`,
    },
  });
  if (error) startError(error.message);
  if (!result.session) redirect("/start?check_email=1");
  redirect("/studio");
}

export async function signInAction(formData: FormData) {
  if (!supabaseConfigured) redirect("/start");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) startError("Wrong email or password.", "signin");
  redirect("/studio");
}

export async function googleSignInAction() {
  if (!supabaseConfigured) redirect("/start");
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data: result, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${SITE}/auth/callback` },
  });
  if (error || !result.url) startError("Google sign-in is unavailable right now.");
  redirect(result.url);
}

/** OAuth users land authed but role-less — this completes their profile. */
export async function completeProfileAction(formData: FormData) {
  const state = await getAuthState();
  if (state.kind !== "needs_profile") redirect("/start");
  const role = formData.get("role") as UserRole;
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!VALID_ROLES.includes(role) || !name) return;

  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/start");

  const { serviceClient } = await import("@/lib/supabase/service");
  await serviceClient()
    .from("profiles")
    .upsert({ id: authUser.id, role, display_name: name }, { onConflict: "id" });
  redirect("/studio");
}

export async function signOutAction() {
  if (supabaseConfigured) {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  await clearSessionCookie();
  redirect("/");
}

/* ---- profile ----------------------------------------------------------- */

export async function updateProfileAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const edit: ProfileEdit = {
    displayName: String(formData.get("displayName") ?? "").trim().slice(0, 60) || user.displayName,
    location: String(formData.get("location") ?? "").trim().slice(0, 80),
    craft: String(formData.get("craft") ?? "").trim().slice(0, 120),
    bio: String(formData.get("bio") ?? "").trim().slice(0, 600),
    genres: formData
      .getAll("genres")
      .map((g) => String(g).trim())
      .filter(Boolean)
      .slice(0, 6),
  };
  await data.updateProfile(user, edit);
  revalidatePath("/account");
  revalidatePath("/studio");
  redirect("/account?saved=1");
}

/* ---- upload ----------------------------------------------------------- */

export async function uploadTrackAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const consent = formData.get("consent") === "on";
  const rights = formData.get("rights") === "on";
  if (!title || !consent || !rights) return;

  const file = formData.get("file");
  const kind: TrackKind =
    user.role === "creator" ? "demo" : user.role === "artist" ? "voice" : "production";
  const track = await data.createTrack(user, {
    title,
    kind,
    file: file instanceof File ? file : null,
  });
  if (!track) redirect("/upload?error=1");
  if (kind === "demo") redirect(`/matches/${track.id}`);
  redirect("/studio");
}

export async function deleteTrackAction(trackId: string) {
  const user = await currentUser();
  if (!user) redirect("/start");
  await data.deleteTrack(user, trackId);
  revalidatePath("/studio");
}

/* ---- requests ---------------------------------------------------------
   Payment buys the right to make the first move. Answering one — reading it,
   hearing the track, accepting, and talking afterwards — is always free. */

export async function sendRequestAction(matchId: string, note?: string) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const result = await data.sendRequest(user, matchId, note?.trim().slice(0, 500) || null);
  revalidatePath("/matches/[trackId]", "page");
  revalidatePath("/feed");
  revalidatePath("/inbox");
  return result;
}

export async function respondRequestAction(requestId: string, accept: boolean) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const threadId = await data.respondToRequest(user, requestId, accept);
  revalidatePath("/inbox");
  revalidatePath("/studio");
  return { threadId };
}

export async function passAction(matchId: string) {
  const user = await currentUser();
  if (!user) redirect("/start");
  await data.passMatch(user, matchId);
  revalidatePath("/feed");
}

/* ---- inbox ------------------------------------------------------------ */

export async function sendMessageAction(threadId: string, formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!body) return;
  // Conversations stay open regardless of subscription — you are never
  // silenced mid-collaboration for lapsing.
  await data.sendMessage(user, threadId, body);
  revalidatePath(`/inbox/${threadId}`);
}

export async function markReadAction(threadId: string) {
  const user = await currentUser();
  if (!user) return;
  await data.markThreadRead(user, threadId);
}

/* ---- billing ----------------------------------------------------------
   With Stripe configured this redirects to Checkout; otherwise the
   subscription is granted directly so the loop stays experiencable. */

export async function subscribeAction(tier: Tier) {
  const user = await currentUser();
  if (!user) redirect("/start");
  if (!tierCoversRole(tier, user.role)) return;

  if (stripeConfigured) {
    const { createCheckoutSession } = await import("@/lib/stripe");
    const url = await createCheckoutSession(user.id, user.email, tier);
    redirect(url);
  }

  await data.setSubscription(user, tier);
  redirect(user.role === "creator" ? "/studio" : "/feed");
}

export async function cancelSubscriptionAction() {
  const user = await currentUser();
  if (!user) redirect("/start");
  await data.cancelSubscription(user);
  revalidatePath("/account");
}
