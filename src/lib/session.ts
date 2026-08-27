import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/types";
import { db, type DemoUser } from "@/lib/demo/store";

const COOKIE = "eb_uid";

export async function currentDemoUser(): Promise<DemoUser | null> {
  const jar = await cookies();
  const uid = jar.get(COOKIE)?.value;
  if (!uid) return null;
  return db().users.get(uid) ?? null;
}

export async function currentUser(): Promise<SessionUser | null> {
  const u = await currentDemoUser();
  if (!u) return null;
  return {
    id: u.id,
    role: u.role,
    displayName: u.displayName,
    email: u.email,
    subscription: u.subscription,
  };
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
