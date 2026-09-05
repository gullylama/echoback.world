/* Core domain types — shared by the demo data layer and the Supabase layer. */

export type UserRole = "creator" | "artist" | "producer";

export type TrackKind = "demo" | "voice" | "production";

/** The four monthly subscription tiers (see doc 07). */
export type Tier =
  | "creator_artists" // £16 — creators reach artists
  | "creator_full" // £20 — creators reach artists + producers
  | "artist" // £16
  | "producer"; // £16

export type RequestState = "pending" | "accepted" | "declined";

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

/** Fields a member can edit about themselves. */
export interface ProfileEdit {
  displayName: string;
  location: string;
  bio: string;
  genres: string[];
  craft: string;
}

export interface Track {
  id: string;
  ownerId: string;
  kind: TrackKind;
  title: string;
  durationSec: number;
  createdAt: string;
  /** deterministic seed for waveform + preview playback */
  seed: number;
  status: "processing" | "fingerprinted" | "failed";
  consentConfirmed: boolean;
}

export interface ComponentScores {
  vocal: number;
  style: number;
  production: number;
  blended: number;
}

/** The state of the single request allowed on a match, from a viewer's side. */
export interface RequestSummary {
  id: string;
  state: RequestState;
  /** true when the viewer is the one who sent it */
  mine: boolean;
  threadId: string | null;
}

/**
 * A match as the *server* is willing to describe it to the current viewer.
 * When `revealed` is false the identity fields are already redacted
 * server-side — the client never receives the real values. The preview seed
 * is always sent: hearing the voice is free, reaching it is not.
 */
export interface MatchView {
  id: string;
  demoTrackId: string;
  scores: ComponentScores;
  revealed: boolean;
  /** plays the talent's reference audio — available before paying */
  previewSeed: number;
  talent: {
    role: UserRole;
    /** redacted to an obscured stand-in when revealed=false */
    displayName: string;
    location: string;
    genres: string[];
    craft: string;
    bio: string;
    avatarSeed: number;
    profileId: string | null; // null until revealed
  };
  request: RequestSummary | null;
}

/** A matched track as shown in the talent discovery feed. */
export interface FeedItemView {
  id: string; // match id
  scores: ComponentScores;
  revealed: boolean;
  createdAt: string;
  demo: {
    title: string; // redacted when not revealed
    durationSec: number;
    seed: number;
    creatorName: string; // redacted when not revealed
    genres: string[];
  };
  request: RequestSummary | null;
}

export type FeedSort = "match" | "newest";

export interface FeedQuery {
  sort?: FeedSort;
  genre?: string;
  q?: string;
}

/** A collaboration request in either direction, for the inbox. */
export interface RequestView {
  id: string;
  matchId: string;
  /** true when it was sent *to* the viewer */
  incoming: boolean;
  state: RequestState;
  note: string | null;
  sentAt: string;
  threadId: string | null;
  scores: ComponentScores;
  counterparty: {
    profileId: string;
    displayName: string;
    role: UserRole;
    avatarSeed: number;
    craft: string;
    genres: string[];
    location: string;
  };
  /** the AI track the request is about — always playable by both sides */
  track: { title: string; seed: number; durationSec: number };
}

export interface ThreadView {
  id: string;
  otherPartyId: string;
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

/** A member's profile as shown to someone allowed to see it. */
export interface ProfileView {
  id: string;
  role: UserRole;
  displayName: string;
  location: string;
  bio: string;
  genres: string[];
  craft: string;
  avatarSeed: number;
  previewSeed: number | null;
  referenceCount: number;
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
    price: "£16",
    audience: "creator",
    blurb: "Reveal every artist your music matches, and reach out first.",
  },
  creator_full: {
    name: "Creator — Artists + Producers",
    price: "£20",
    audience: "creator",
    blurb: "The full echo: artists and producers, revealed and reachable.",
  },
  artist: {
    name: "Artist",
    price: "£16",
    audience: "artist",
    blurb: "Search every track matched to your voice, and reach out first.",
  },
  producer: {
    name: "Producer",
    price: "£16",
    audience: "producer",
    blurb: "Search every track matched to your sound, and reach out first.",
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

export const ALL_GENRES = [
  "Alt-R&B", "Neo-soul", "Trap-soul", "Afrobeats", "Alté", "Amapiano",
  "City pop", "Future funk", "Dream pop", "Synth pop", "Indie electronic",
  "Indie rock", "Post-punk", "Indie folk", "Folk", "Americana",
  "UK garage", "Soulful house", "House", "Melodic techno", "Ambient",
  "Chanson", "Downtempo pop", "Latin indie", "Bolero revival",
  "Nordic folk", "Ambient pop", "Arabic pop", "Baile funk", "Global club",
] as const;
