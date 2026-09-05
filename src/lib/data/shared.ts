/*
  Gating + redaction rules shared by the demo and Supabase data layers.
  Redaction happens HERE, server-side, before anything reaches a client.

  The governing rule: **payment buys the right to make the first move.**
  Answering a request — reading it, hearing the track, accepting, and
  conversing afterwards — is always free, so a paying member always reaches
  a reachable human.
*/

import type { MatchView, Profile, SessionUser, UserRole } from "@/lib/types";
import { tierCoversProducers, tierCoversRole } from "@/lib/types";
import { obscureName } from "@/lib/demo/seed";

export function hasActiveSub(user: SessionUser): boolean {
  return user.subscription?.status === "active" && tierCoversRole(user.subscription.tier, user.role);
}

/** Can this creator see the identity behind a match with this talent role? */
export function creatorCanReveal(user: SessionUser, talentRole: "artist" | "producer"): boolean {
  if (!hasActiveSub(user)) return false;
  if (talentRole === "producer") return tierCoversProducers(user.subscription!.tier);
  return true;
}

/** Can this member send the first message to someone of `counterpartyRole`? */
export function canInitiate(user: SessionUser, counterpartyRole: UserRole): boolean {
  if (user.role === "creator") {
    if (counterpartyRole === "creator") return false;
    return creatorCanReveal(user, counterpartyRole);
  }
  return hasActiveSub(user);
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
    // country only — enough to judge fit, not enough to identify
    location: talent.location.split(",").pop()?.trim() ?? "",
    genres: talent.genres,
    craft: talent.craft,
    bio: "",
    avatarSeed: talent.avatarSeed,
    profileId: null,
  };
}
