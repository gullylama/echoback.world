/*
  Deterministic PLACEHOLDER embeddings — a plumbing test, not a fingerprint.

  These let you verify the whole live pipeline (upload → vectors → cached
  matches → reveal → request → conversation) against a real database before
  standing up GPU infrastructure. They are derived from the file's content
  hash, NOT from its audio, so the resulting similarities are meaningless as
  match quality. They exist only so the plumbing can be proven.

  Two properties are deliberately preserved from the real worker:
    - Identical files always produce identical vectors (idempotent).
    - Similarities land in a realistic spread rather than all-or-nothing,
      so the ranked UI can be judged on something lifelike.

  Delete the seeded rows and re-run the real worker before launch.
*/

export const EMBEDDING_DIM = 512;

const CLUSTERS = 8;
/** How strongly cluster centres share a common base — sets inter-cluster similarity. */
const BASE_MIX = 0.55;
/** How strongly a track sits on its cluster centre — sets intra-cluster similarity. */
const CENTRE_MIX = 0.8;
const NOISE_MIX = 0.35;

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, fully deterministic. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller: turns two uniforms into a standard normal. */
function gaussianVector(rand: () => number): number[] {
  const v = new Array<number>(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const u1 = Math.max(rand(), Number.EPSILON);
    const u2 = rand();
    v[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return v;
}

function normalise(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const n = Math.sqrt(sum);
  if (n === 0) return v;
  return v.map((x) => x / n);
}

function blend(a: number[], wa: number, b: number[], wb: number): number[] {
  const out = new Array<number>(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) out[i] = a[i] * wa + b[i] * wb;
  return normalise(out);
}

/** One fixed base per component, so vocal/style/production stay independent. */
const baseCache = new Map<string, number[]>();
function componentBase(component: string): number[] {
  const cached = baseCache.get(component);
  if (cached) return cached;
  const base = normalise(gaussianVector(prng(hash32(`echoback:base:${component}`))));
  baseCache.set(component, base);
  return base;
}

const centreCache = new Map<string, number[]>();
function clusterCentre(component: string, index: number): number[] {
  const key = `${component}:${index}`;
  const cached = centreCache.get(key);
  if (cached) return cached;
  const variation = normalise(gaussianVector(prng(hash32(`echoback:centre:${key}`))));
  const centre = blend(componentBase(component), BASE_MIX, variation, 1 - BASE_MIX);
  centreCache.set(key, centre);
  return centre;
}

/**
 * A stable unit vector for (contentHash, component). Same input always
 * yields the same vector; different inputs land in one of a few clusters
 * so scores spread across a believable range instead of 0 or 100.
 */
export function placeholderVector(contentHash: string, component: string): number[] {
  const key = `${contentHash}:${component}`;
  const cluster = hash32(key) % CLUSTERS;
  const noise = normalise(gaussianVector(prng(hash32(`echoback:track:${key}`))));
  return blend(clusterCentre(component, cluster), CENTRE_MIX, noise, NOISE_MIX);
}

export function placeholderFingerprint(contentHash: string) {
  return {
    vocal: placeholderVector(contentHash, "vocal"),
    style: placeholderVector(contentHash, "style"),
    production: placeholderVector(contentHash, "production"),
  };
}
