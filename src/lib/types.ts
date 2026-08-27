/* Core domain types — shared by the demo data layer and the Supabase layer. */

export type UserRole = "creator" | "artist" | "producer";

export type TrackKind = "demo" | "voice" | "production";

/** The four monthly subscription tiers (see doc 07). */
export type Tier =
  | "creator_artists" // £15.99 — creators reach artists
  | "creator_full" // £20 — creators reach artists + producers
  | "artist" // £15.99
  | "producer"; // £15.99

export interface Profile {
  id: string;
  role: UserRole;
  displayName: string;
  location: string;
  bio: string;
  genres: string[];
  /** e.g. vocal range, production specialities */
  craft: string;
  avatarSeed: number;
}

export interface Track {
  id: string;
  ownerId: string;
  kind: TrackKind;
  title: string;
  durationSec: number;
  createdAt: string;
  /** deterministic seed for waveform + synth preview */
  seed: number;
  status: "processing" | "fingerprinted";
  consentConfirmed: boolean;
}

export interface ComponentScores {
  vocal: number;
  style: number;
  production: number;
  blended: number;
}

/**
 * A match as the *server* is willing to describe it to the current viewer.
 * When `revealed` is false the identity fields are already redacted
 * server-side — the client never receives the real values.
 */
export interface MatchView {
  id: string;
  demoTrackId: string;
  scores: ComponentScores;
  revealed: boolean;
  talent: {
    role: UserRole;
    /** redacted to obscured initials when revealed=false */
    displayName: string;
    location: string;
    genres: string[];
    craft: string;
    bio: string;
    avatarSeed: number;
    profileId: string | null; // null until revealed
  };
  /** viewer's interest state */
  interested: boolean;
  mutual: boolean;
}

/** A demo as shown in the talent swipe feed. */
export interface FeedItemView {
  id: string; // match id
  scores: ComponentScores;
  revealed: boolean;
  demo: {
    title: string; // redacted when not revealed
    durationSec: number;
    seed: number;
    creatorName: string; // redacted when not revealed
    genres: string[];
  };
}

export interface ThreadView {
  id: string;
  otherPartyName: string;
  otherPartyRole: UserRole;
  demoTitle: string;
  avatarSeed: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: boolean;
}

export interface MessageView {
  id: string;
  mine: boolean;
  body: string;
  sentAt: string;
}

export interface Subscription {
  tier: Tier;
  status: "active" | "lapsed";
  renewsAt: string;
}

export interface SessionUser {
  id: string;
  role: UserRole;
  displayName: string;
  email: string;
  subscription: Subscription | null;
}

export const TIER_META: Record<
  Tier,
  { name: string; price: string; audience: UserRole; blurb: string }
> = {
  creator_artists: {
    name: "Creator — Artists",
    price: "£15.99",
    audience: "creator",
    blurb: "Reveal and contact every artist your demos match.",
  },
  creator_full: {
    name: "Creator — Artists + Producers",
    price: "£20",
    audience: "creator",
    blurb: "The full echo: artists and producers, revealed and reachable.",
  },
  artist: {
    name: "Artist",
    price: "£15.99",
    audience: "artist",
    blurb: "Unlock the feed of demos matched to your voice.",
  },
  producer: {
    name: "Producer",
    price: "£15.99",
    audience: "producer",
    blurb: "Unlock the feed of demos matched to your sound.",
  },
};

/** Which tiers grant a given role access. */
export function tierCoversRole(tier: Tier, role: UserRole): boolean {
  if (role === "creator") return tier === "creator_artists" || tier === "creator_full";
  return tier === role;
}

/** Whether a creator subscription reaches producers. */
export function tierCoversProducers(tier: Tier): boolean {
  return tier === "creator_full";
}
