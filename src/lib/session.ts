import { cookies } from "next/headers";
import type { SessionUser, UserRole } from "@/lib/types";
import { db, type DemoUser } from "@/lib/demo/store";
import { supabaseConfigured } from "@/lib/config";

const COOKIE = "eb_uid";

export type AuthState =
  | { kind: "none" }
  | { kind: "authed"; user: SessionUser }
  /** Signed in (e.g. via Google) but hasn't picked a role / name yet. */
  | { kind: "needs_profile"; email: string; suggestedName: string };

/* ---- demo mode -------------------------------------------------------- */

export async function currentDemoUser(): Promise<DemoUser | null> {
  const jar = await cookies();
  const uid = jar.get(COOKIE)?.value;
  if (!uid) return null;
  return db().users.get(uid) ?? null;
}

export async function setSessionCookie(uid: string) {
  const jar = await cookies();
  jar.set(COOKIE, uid, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/* ---- unified session -------------------------------------------------- */

export async function getAuthState(): Promise<AuthState> {
  if (!supabaseConfigured) {
    const u = await currentDemoUser();
    if (!u) return { kind: "none" };
    return {
      kind: "authed",
      user: {
        id: u.id,
        role: u.role,
        displayName: u.displayName,
        email: u.email,
        subscription: u.subscription,
      },
    };
  }

  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { kind: "none" };

  const { serviceClient } = await import("@/lib/supabase/service");
  const svc = serviceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", authUser.id)
    .maybeSingle();

  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;

  if (!profile) {
    // Email sign-ups carry role + name in metadata → auto-provision.
    const metaRole = meta.role as UserRole | undefined;
    const metaName = (meta.display_name as string | undefined)?.trim();
    if (metaRole && ["creator", "artist", "producer"].includes(metaRole) && metaName) {
      await svc.from("profiles").insert({
        id: authUser.id,
        role: metaRole,
        display_name: metaName.slice(0, 60),
      });
      return buildAuthed(authUser.id, metaRole, metaName, authUser.email ?? "");
    }
    // OAuth sign-ins pick role + name in onboarding.
    const suggested =
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      authUser.email?.split("@")[0] ??
      "";
    return { kind: "needs_profile", email: authUser.email ?? "", suggestedName: suggested };
  }

  return buildAuthed(profile.id, profile.role as UserRole, profile.display_name, authUser.email ?? "");
}

async function buildAuthed(
  id: string,
  role: UserRole,
  displayName: string,
  email: string
): Promise<AuthState> {
  const { getSubscription } = await import("@/lib/data/supabase");
  const subscription = await getSubscription(id);
  return { kind: "authed", user: { id, role, displayName, email, subscription } };
}

export async function currentUser(): Promise<SessionUser | null> {
  const state = await getAuthState();
  return state.kind === "authed" ? state.user : null;
}
