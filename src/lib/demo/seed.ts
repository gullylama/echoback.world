/* Deterministic seed content for demo mode. No real people. */

import type { Profile, UserRole } from "@/lib/types";

/** Small fast deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generate an obscured stand-in for an identity string. Derived only from
 * `salt` — never from the real value — so nothing leaks pre-subscription.
 */
export function obscureName(salt: string): string {
  const syll = ["ka", "ren", "mo", "li", "sa", "tho", "ne", "vi", "or", "da", "yu", "el"];
  const r = rng(hashString(salt));
  const word = (n: number) => {
    let w = "";
    for (let i = 0; i < n; i++) w += syll[Math.floor(r() * syll.length)];
    return w[0].toUpperCase() + w.slice(1);
  };
  return `${word(2)} ${word(2 + Math.floor(r() * 2))}`;
}

export const SEED_ARTISTS: Profile[] = [
  { id: "a1", role: "artist", displayName: "Mara Solene", location: "London, UK", genres: ["Alt-R&B", "Neo-soul"], craft: "Contralto — smoked, close-mic intimacy", bio: "Ex-choir lead turned late-night soul writer. Sings like the room is small on purpose.", avatarSeed: 11 },
  { id: "a2", role: "artist", displayName: "Kojo Abena", location: "Accra, GH", genres: ["Afrobeats", "Alté"], craft: "Tenor — elastic melodic runs, bilingual delivery", bio: "Alté sessions by night, hooks that travel by morning.", avatarSeed: 12 },
  { id: "a3", role: "artist", displayName: "Yuki Harada", location: "Osaka, JP", genres: ["City pop", "Indie electronic"], craft: "Airy soprano — glassy head voice, precise pitch", bio: "Raised on 80s city pop cassettes; writes future versions of them.", avatarSeed: 13 },
  { id: "a4", role: "artist", displayName: "Cassian Vale", location: "Manchester, UK", genres: ["Indie rock", "Post-punk"], craft: "Baritone — spoken-sung, northern grain", bio: "Fronts a post-punk trio; lends his voice to anything with nerve.", avatarSeed: 14 },
  { id: "a5", role: "artist", displayName: "Ines Beaumont", location: "Paris, FR", genres: ["Chanson", "Downtempo pop"], craft: "Mezzo — breathy sustain, French/English", bio: "Torch songs for streaming speeds.", avatarSeed: 15 },
  { id: "a6", role: "artist", displayName: "Deja Lyons", location: "Atlanta, US", genres: ["Trap-soul", "R&B"], craft: "Alto — melisma with restraint, stacked harmonies", bio: "Session harmony arranger stepping out front.", avatarSeed: 16 },
  { id: "a7", role: "artist", displayName: "Tomas Reyes", location: "Mexico City, MX", genres: ["Latin indie", "Bolero revival"], craft: "Tenor — warm vibrato, romantic phrasing", bio: "Bolero kid with a bedroom-pop laptop.", avatarSeed: 17 },
  { id: "a8", role: "artist", displayName: "Freya Nordvik", location: "Bergen, NO", genres: ["Nordic folk", "Ambient pop"], craft: "Soprano — choral purity, close harmonies with herself", bio: "Sings like weather. Writes like winter.", avatarSeed: 18 },
  { id: "a9", role: "artist", displayName: "Ezra Whitfield", location: "Bristol, UK", genres: ["UK garage", "Soulful house"], craft: "Falsetto — clipped phrasing built for 2-step", bio: "Voice of a hundred white labels; name on none, until now.", avatarSeed: 19 },
  { id: "a10", role: "artist", displayName: "Noor Haddad", location: "Amman, JO", genres: ["Arabic pop", "Electronic"], craft: "Mezzo — maqam-inflected ornament over 4/4", bio: "Two musical worlds; one voice that refuses to pick.", avatarSeed: 20 },
];

export const SEED_PRODUCERS: Profile[] = [
  { id: "p1", role: "producer", displayName: "Halcyon Dive", location: "Berlin, DE", genres: ["Melodic techno", "Ambient"], craft: "Analogue-first: modular textures, tape saturation", bio: "Builds rooms out of reverb, then furnishes them.", avatarSeed: 31 },
  { id: "p2", role: "producer", displayName: "Ruthie Okon", location: "Lagos, NG", genres: ["Afrobeats", "Amapiano"], craft: "Log-drum pressure, airy top-end, vocal chops", bio: "Percussion is a language; she's fluent.", avatarSeed: 32 },
  { id: "p3", role: "producer", displayName: "Sable & Pine", location: "Nashville, US", genres: ["Indie folk", "Americana"], craft: "Live-room capture, string arrangement, ribbon mics", bio: "Duo. One engineers, one arranges, both argue about mandolin.", avatarSeed: 33 },
  { id: "p4", role: "producer", displayName: "Kenji Morita", location: "Tokyo, JP", genres: ["City pop", "Future funk"], craft: "DX7 sparkle, slap bass programming, chorused guitar", bio: "Restores the 1984 sound with 2026 loudness.", avatarSeed: 34 },
  { id: "p5", role: "producer", displayName: "Delphine Cruz", location: "São Paulo, BR", genres: ["Baile funk", "Global club"], craft: "Sub-heavy drums, chopped acapellas, raw energy", bio: "If the floor isn't moving, it isn't finished.", avatarSeed: 35 },
  { id: "p6", role: "producer", displayName: "Old Habits", location: "Sheffield, UK", genres: ["Post-punk", "Indie rock"], craft: "Room drums, bass-forward mixes, first-take vocals", bio: "Believes in take three, maximum.", avatarSeed: 36 },
];

/** Fake creators whose demos populate the talent feed. */
export const SEED_CREATORS: Profile[] = [
  { id: "c1", role: "creator", displayName: "N. Okri", location: "London, UK", genres: ["Alt-R&B"], craft: "Writes with AI, finishes with people", bio: "", avatarSeed: 51 },
  { id: "c2", role: "creator", displayName: "Field Notes", location: "Seoul, KR", genres: ["Indie electronic"], craft: "Demo-a-day practice", bio: "", avatarSeed: 52 },
  { id: "c3", role: "creator", displayName: "J. Marsh", location: "Dublin, IE", genres: ["Folk", "Americana"], craft: "Songs first, sounds second", bio: "", avatarSeed: 53 },
  { id: "c4", role: "creator", displayName: "Vera Lin", location: "Taipei, TW", genres: ["City pop", "Dream pop"], craft: "Melody obsessive", bio: "", avatarSeed: 54 },
  { id: "c5", role: "creator", displayName: "Baseline Theory", location: "Chicago, US", genres: ["House", "UKG"], craft: "Toplines looking for a voice", bio: "", avatarSeed: 55 },
];

export const FEED_DEMO_TITLES: { title: string; creatorId: string; genres: string[]; dur: number }[] = [
  { title: "Glasshouse", creatorId: "c1", genres: ["Alt-R&B"], dur: 172 },
  { title: "Neon Vows", creatorId: "c4", genres: ["City pop", "Dream pop"], dur: 201 },
  { title: "Patience (Sketch 4)", creatorId: "c1", genres: ["Neo-soul"], dur: 158 },
  { title: "Coastal", creatorId: "c2", genres: ["Indie electronic"], dur: 187 },
  { title: "Never Meant It", creatorId: "c5", genres: ["UK garage"], dur: 164 },
  { title: "Wintering", creatorId: "c3", genres: ["Folk"], dur: 214 },
  { title: "Satellite Heart", creatorId: "c4", genres: ["Synth pop"], dur: 196 },
  { title: "Low Light", creatorId: "c1", genres: ["Trap-soul"], dur: 149 },
];

export function roleLabel(role: UserRole): string {
  return role === "creator" ? "Creator" : role === "artist" ? "Artist" : "Producer";
}
