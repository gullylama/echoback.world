/*
  The marble: a track's fingerprint, made visible.

  Six numbers drive the shader that draws a track's orb. They come from the
  three component embeddings by FIXED random projection — the same six
  directions for every track, forever. That matters: random projection
  approximately preserves distance (Johnson–Lindenstrauss), so two tracks
  whose vectors are close produce close marbles. Tracks that sound alike
  look alike, and the picture carries the same signal the matching engine
  does rather than being decoration bolted onto it.

  The projection directions must never change once tracks are in the
  database. Changing them would silently repaint every marble in the
  product, and people will have learned what their own sound looks like.

  Before a track is fingerprinted there is nothing to project, so the
  marble falls back to its content hash — stable, unique, but meaningless.
  It changes once when the engine finishes listening, which is honest: the
  track becomes itself.
*/

/** How many numbers a marble is made of. Mirrored by the SQL constraint. */
export const MARBLE_LEN = 6;

export type Marble = number[];

/* Deterministic PRNG — the projection directions are generated, not stored,
   so they can never drift out of step between server and worker. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fixed unit direction in `dim` dimensions. Same seed, same direction. */
function direction(seed: number, dim: number): Float32Array {
  const r = rng(seed);
  const v = new Float32Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    // Box–Muller: gaussian components give a direction uniform on the sphere,
    // which uniform components would not.
    const u1 = Math.max(1e-9, r());
    const u2 = r();
    const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    v[i] = g;
    norm += g * g;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

const DIRECTION_CACHE = new Map<string, Float32Array>();
function cachedDirection(seed: number, dim: number): Float32Array {
  const key = `${seed}:${dim}`;
  let d = DIRECTION_CACHE.get(key);
  if (!d) {
    d = direction(seed, dim);
    DIRECTION_CACHE.set(key, d);
  }
  return d;
}

function project(vec: number[], seed: number): number {
  const dir = cachedDirection(seed, vec.length);
  let dot = 0;
  for (let i = 0; i < vec.length; i++) dot += vec[i] * dir[i];
  return dot;
}

/*
  Embeddings are L2-normalised, so a projection onto a unit direction lands
  in [-1, 1] but clusters hard around zero — the expected magnitude is about
  1/sqrt(512). Scaling by sqrt(dim) spreads it back out to roughly unit
  variance, then tanh keeps the tail bounded without clipping it flat.
*/
function spread(dot: number, dim: number): number {
  return Math.tanh(dot * Math.sqrt(dim) * 0.55);
}

/**
 * Six stable numbers in [0, 1] for one fingerprint.
 *
 * Each component drives a different property of the orb, and each is drawn
 * from the vector that ought to control it: style sets the colour, because
 * style is what a listener would call the "colour" of a track; production
 * sets the structure; the voice sets how brightly it burns.
 */
export function marbleFromVectors(
  vocal: number[],
  style: number[],
  production: number[]
): Marble {
  const dim = style.length || 512;
  const unit = (x: number) => Math.min(1, Math.max(0, x * 0.5 + 0.5));
  return [
    unit(spread(project(style, 0x5eed01), dim)), // hue centre
    unit(spread(project(style, 0x5eed02), dim)), // hue spread
    unit(spread(project(production, 0x5eed03), dim)), // warp / turbulence
    unit(spread(project(production, 0x5eed04), dim)), // grain scale
    unit(spread(project(vocal, 0x5eed05), dim)), // brightness
    unit(spread(project(vocal, 0x5eed06), dim)), // phase / rotation
  ];
}

/**
 * Stand-in for a track that has not been fingerprinted yet. Unique and
 * stable per file, but carrying no information about how it sounds — it is
 * replaced the moment the engine finishes.
 */
export function marbleFromHash(hash: string): Marble {
  let h = 0;
  for (let i = 0; i < hash.length; i++) h = (Math.imul(h, 31) + hash.charCodeAt(i)) | 0;
  const r = rng(h || 1);
  return Array.from({ length: MARBLE_LEN }, () => r());
}

/** Accepts whatever the database returns and never hands the UI a bad shape. */
export function normaliseMarble(value: unknown, fallbackHash?: string): Marble {
  if (Array.isArray(value) && value.length === MARBLE_LEN) {
    const out = value.map((n) => {
      const x = typeof n === "number" ? n : Number(n);
      return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5;
    });
    return out;
  }
  return marbleFromHash(fallbackHash || "echoback");
}
