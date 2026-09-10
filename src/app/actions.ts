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
import { after } from "next/server";
import { stripeConfigured, supabaseConfigured } from "@/lib/config";
import {
  notifyNewMessage,
  notifyRequestAccepted,
  notifyRequestReceived,
} from "@/lib/email";
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
  if (!result.session) redirect(`/start?check_email=${encodeURIComponent(email)}`);
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

/** Confirmation emails get lost and links expire — let people ask again. */
export async function resendConfirmationAction(formData: FormData) {
  if (!supabaseConfigured) redirect("/start");
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/start");

  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${SITE}/auth/callback` },
  });
  if (error) {
    const tooSoon = /security purposes|rate|seconds/i.test(error.message);
    startError(
      tooSoon
        ? "Just a moment — you can request another email in about a minute."
        : "We couldn't send that email. Check the address and try again.",
    );
  }
  redirect(`/start?check_email=${encodeURIComponent(email)}&resent=1`);
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

/* ---- upload -----------------------------------------------------------
   The file goes straight from the browser to storage: Vercel caps
   serverless request bodies at 4.5MB, which no real song fits under. The
   server only reserves the slot and records what landed. */

function kindFor(role: UserRole): TrackKind {
  return role === "creator" ? "demo" : role === "artist" ? "voice" : "production";
}

export async function createUploadTicketAction(ext: string) {
  const user = await currentUser();
  if (!user) return { ok: false as const, reason: "auth" };
  const ticket = await data.createUploadTicket(user, ext);
  if (!ticket) {
    // Demo mode has nowhere to put it — the caller finalises without a file.
    return { ok: true as const, ticket: null };
  }
  return { ok: true as const, ticket };
}

export async function finaliseUploadAction(meta: {
  title: string;
  path: string;
  contentHash: string;
  byteSize: number;
  durationSec: number;
  peaks: number[];
}) {
  const user = await currentUser();
  if (!user) return { ok: false as const, reason: "auth" };
  const title = meta.title.trim().slice(0, 80);
  if (!title) return { ok: false as const, reason: "title" };

  const kind = kindFor(user.role);
  const track = await data.finaliseUpload(user, kind, {
    title,
    path: meta.path,
    contentHash: meta.contentHash,
    byteSize: meta.byteSize,
    durationSec: meta.durationSec,
    peaks: Array.isArray(meta.peaks) ? meta.peaks.slice(0, 400) : [],
  });
  if (!track) return { ok: false as const, reason: "store" };

  revalidatePath("/studio");
  return {
    ok: true as const,
    next: kind === "demo" ? `/matches/${track.id}` : "/studio",
  };
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
  const cleanNote = note?.trim().slice(0, 500) || null;
  const result = await data.sendRequest(user, matchId, cleanNote);

  // Notification runs after the response — it must never delay or break
  // the action that triggered it.
  if (result.ok && result.recipientId) {
    const recipientId = result.recipientId;
    const trackTitle = result.trackTitle ?? "a track";
    after(async () => {
      const target = await data.notifyTarget(recipientId);
      if (target) {
        await notifyRequestReceived(target.email, {
          senderName: user.displayName,
          trackTitle,
          note: cleanNote,
        });
      }
    });
  }

  revalidatePath("/matches/[trackId]", "page");
  revalidatePath("/feed");
  revalidatePath("/inbox");
  return result;
}

export async function respondRequestAction(requestId: string, accept: boolean) {
  const user = await currentUser();
  if (!user) redirect("/start");
  const result = await data.respondToRequest(user, requestId, accept);

  if (accept && result.threadId && result.senderId) {
    const { senderId, threadId } = result;
    const trackTitle = result.trackTitle ?? "your track";
    after(async () => {
      const target = await data.notifyTarget(senderId);
      if (target) {
        await notifyRequestAccepted(target.email, {
          recipientName: user.displayName,
          trackTitle,
          threadId,
        });
      }
    });
  }

  revalidatePath("/inbox");
  revalidatePath("/studio");
  return { threadId: result.threadId };
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
  const sent = await data.sendMessage(user, threadId, body);

  if (sent?.otherPartyId) {
    const otherPartyId = sent.otherPartyId;
    after(async () => {
      const target = await data.notifyTarget(otherPartyId);
      if (target) {
        await notifyNewMessage(target.email, {
          senderName: user.displayName,
          preview: body,
          threadId,
        });
      }
    });
  }

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

/** Right to erasure — irreversible, so it needs the word typed out. */
export async function deleteAccountAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect("/start");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    redirect("/account?delete_error=1");
  }
  await data.deleteAccount(user);
  if (supabaseConfigured) {
    const { supabaseServer } = await import("@/lib/supabase/server");
    await (await supabaseServer()).auth.signOut();
  }
  await clearSessionCookie();
  redirect("/?deleted=1");
}

export async function setEmailNotificationsAction(enabled: boolean) {
  const user = await currentUser();
  if (!user) redirect("/start");
  await data.setEmailNotifications(user, enabled);
  revalidatePath("/account");
}

export async function cancelSubscriptionAction() {
  const user = await currentUser();
  if (!user) redirect("/start");
  await data.cancelSubscription(user);
  revalidatePath("/account");
}
