"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Tier, TrackKind, UserRole } from "@/lib/types";
import { tierCoversRole } from "@/lib/types";
import {
  cancelSubscription,
  createDemoTrack,
  createDemoUser,
  expressInterest,
  markThreadRead,
  passMatch,
  sendMessage,
  setSubscription,
} from "@/lib/demo/store";
import { clearSessionCookie, currentDemoUser, setSessionCookie } from "@/lib/session";
import { stripeConfigured } from "@/lib/config";

/* ---- auth ------------------------------------------------------------- */

export async function signUpAction(formData: FormData) {
  const role = formData.get("role") as UserRole;
  const name = String(formData.get("name") ?? "").trim();
  if (!["creator", "artist", "producer"].includes(role) || !name) return;
  const user = createDemoUser(role, name.slice(0, 60));
  await setSessionCookie(user.id);
  redirect("/studio");
}

export async function signOutAction() {
  await clearSessionCookie();
  redirect("/");
}

/* ---- upload ----------------------------------------------------------- */

export async function uploadTrackAction(formData: FormData) {
  const user = await currentDemoUser();
  if (!user) redirect("/start");
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const consent = formData.get("consent") === "on";
  const rights = formData.get("rights") === "on";
  if (!title || !consent || !rights) return;
  const kind: TrackKind =
    user.role === "creator" ? "demo" : user.role === "artist" ? "voice" : "production";
  const track = createDemoTrack(user, title, kind);
  if (kind === "demo") redirect(`/matches/${track.id}`);
  redirect("/studio");
}

/* ---- matching --------------------------------------------------------- */

export async function interestAction(matchId: string) {
  const user = await currentDemoUser();
  if (!user) redirect("/start");
  const result = expressInterest(user, matchId);
  revalidatePath("/matches/[trackId]", "page");
  revalidatePath("/feed");
  revalidatePath("/inbox");
  return result;
}

export async function passAction(matchId: string) {
  const user = await currentDemoUser();
  if (!user) redirect("/start");
  passMatch(user, matchId);
  revalidatePath("/feed");
}

/* ---- inbox ------------------------------------------------------------ */

export async function sendMessageAction(threadId: string, formData: FormData) {
  const user = await currentDemoUser();
  if (!user) redirect("/start");
  if (user.subscription?.status !== "active") return; // lapsed = read-only
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (!body) return;
  sendMessage(user, threadId, body);
  revalidatePath(`/inbox/${threadId}`);
}

export async function markReadAction(threadId: string) {
  const user = await currentDemoUser();
  if (!user) return;
  markThreadRead(user, threadId);
}

/* ---- billing ----------------------------------------------------------
   With Stripe configured this redirects to Checkout; in demo mode the
   subscription is granted instantly so pay-to-reveal can be experienced. */

export async function subscribeAction(tier: Tier) {
  const user = await currentDemoUser();
  if (!user) redirect("/start");
  if (!tierCoversRole(tier, user.role)) return;

  if (stripeConfigured) {
    const { createCheckoutSession } = await import("@/lib/stripe");
    const url = await createCheckoutSession(user.id, user.email, tier);
    redirect(url);
  }

  setSubscription(user, tier);
  redirect(user.role === "creator" ? "/studio" : "/feed");
}

export async function cancelSubscriptionAction() {
  const user = await currentDemoUser();
  if (!user) redirect("/start");
  cancelSubscription(user);
  revalidatePath("/account");
}
