/*
  Gating + redaction rules shared by the demo and Supabase data layers.
  Redaction happens HERE, server-side, before anything reaches a client.
*/

import type { MatchView, Profile, SessionUser } from "@/lib/types";
import { tierCoversProducers, tierCoversRole } from "@/lib/types";
import { obscureName } from "@/lib/demo/seed";

export function hasActiveSub(user: SessionUser): boolean {
  return user.subscription?.status === "active" && tierCoversRole(user.subscription.tier, user.role);
}

/** Can this creator reveal a match against this talent role? */
export function creatorCanReveal(user: SessionUser, talentRole: "artist" | "producer"): boolean {
  if (!hasActiveSub(user)) return false;
  if (talentRole === "producer") return tierCoversProducers(user.subscription!.tier);
  return true;
}

/** Lapsed subscribers keep their inbox, read-only. */
export function inboxWritable(user: SessionUser): boolean {
  return user.subscription?.status === "active";
}

export function talentView(
  revealed: boolean,
  talent: Profile,
  matchId: string
): MatchView["talent"] {
  if (revealed) {
    return {
      role: talent.role,
      displayName: talent.displayName,
      location: talent.location,
      genres: talent.genres,
      craft: talent.craft,
      bio: talent.bio,
      avatarSeed: talent.avatarSeed,
      profileId: talent.id,
    };
  }
  return {
    role: talent.role,
    displayName: obscureName(matchId),
    location: talent.location.split(",").pop()?.trim() ?? "",
    genres: talent.genres,
    craft: talent.craft,
    bio: "",
    avatarSeed: talent.avatarSeed,
    profileId: null,
  };
}
