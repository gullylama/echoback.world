/*
  Draws marbles.

  The hard constraint here is that browsers allow only around sixteen live
  WebGL contexts and silently kill the oldest when you pass that. A feed is
  an unbounded list, so one canvas per marble is not an option — it would
  work in development with four tracks and break the moment the page had
  twenty.

  So: ONE shared context, offscreen, drawing each marble once into a bitmap
  that is then cached and shown as an ordinary image. A marble in a list
  does not need to move. Only the one you are actually looking at — the
  track that is playing — gets a live canvas, and there is at most one of
  those.

  Everything is guarded: no WebGL, lost context, or a failed compile all
  return null, and the caller paints a CSS stand-in instead.
*/

import type { Marble } from "@/lib/marble";

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;

uniform float uHue;     // centre of this track's colour
uniform float uSpread;  // how far its colour travels
uniform float uWarp;    // how turbulent the interior is
uniform float uGrain;   // scale of the frost
uniform float uGlow;    // how brightly it burns
uniform float uPhase;   // where in its own weather it sits
uniform float uTime;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}
float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p, int octaves) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    s += a * gnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}

/* Same palette as the hero: one world, seen at two scales. */
vec3 spectrum(float t) {
  t = fract(t);
  vec3 c0 = vec3(0.494, 0.831, 0.910);
  vec3 c1 = vec3(0.498, 0.659, 0.910);
  vec3 c2 = vec3(0.604, 0.549, 0.902);
  vec3 c3 = vec3(0.725, 0.541, 0.871);
  vec3 c4 = vec3(0.867, 0.561, 0.816);
  vec3 c5 = vec3(0.949, 0.627, 0.741);
  vec3 c6 = vec3(0.965, 0.765, 0.651);
  if (t < 0.17) return mix(c0, c1, smoothstep(0.0, 0.17, t));
  if (t < 0.38) return mix(c1, c2, smoothstep(0.17, 0.38, t));
  if (t < 0.56) return mix(c2, c3, smoothstep(0.38, 0.56, t));
  if (t < 0.73) return mix(c3, c4, smoothstep(0.56, 0.73, t));
  if (t < 0.88) return mix(c4, c5, smoothstep(0.73, 0.88, t));
  if (t < 0.96) return mix(c5, c6, smoothstep(0.88, 0.96, t));
  return mix(c6, c0, smoothstep(0.96, 1.0, t)); // closes the wheel
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * 2.0 - 1.0;
  float r2 = dot(p, p);

  // outside the sphere: nothing. A soft edge so it is not a jagged circle.
  float edge = smoothstep(1.0, 0.965, sqrt(r2));
  if (edge <= 0.001) { frag = vec4(0.0); return; }

  // the surface normal of a sphere, from which everything else follows
  float z = sqrt(max(0.0, 1.0 - r2));
  vec3 n = vec3(p, z);

  /*
    Refraction, faked but faithful in the way that matters: the interior is
    sampled at a point pushed outward by the surface curvature, so the
    pattern crowds toward the rim exactly as it does inside real glass.
  */
  vec2 ip = p * (0.62 + 0.38 / (z + 0.42));
  float t = uTime * 0.06 + uPhase * 40.0;

  // the track's own weather
  float warp = 0.7 + uWarp * 2.6;
  vec2 q = vec2(fbm(ip * warp + vec2(t * 0.05, 0.0), 3),
                fbm(ip * warp + vec2(4.7, 2.3) - vec2(0.0, t * 0.04), 3));
  float body = fbm(ip * (1.2 + uWarp * 1.8) + 2.2 * q + uPhase * 12.0, 4);
  float veil = fbm(ip * (5.0 + uGrain * 9.0) + q + uPhase * 7.0, 2);

  float intensity = pow(clamp(body * 0.5 + 0.5, 0.0, 1.0), 1.35);
  intensity *= 0.78 + 0.22 * (veil * 0.5 + 0.5);
  intensity *= 0.55 + 0.85 * uGlow;

  // hue centred on this track, travelling as far as this track travels
  float hue = uHue + (body * 0.5 + q.x * 0.3) * (0.06 + uSpread * 0.42);
  vec3 col = spectrum(hue);

  float core = smoothstep(0.55, 1.0, intensity);
  col = mix(col, mix(col, vec3(1.0), 0.55), core);

  vec3 ground = mix(vec3(0.047, 0.039, 0.110), vec3(0.106, 0.098, 0.180), uv.y);
  vec3 outc = ground + col * intensity * 1.75;

  /*
    Frost. Fewer taps than the hero because a marble is small, but the same
    principle: jittered scattering, not a blur — and scattering that varies
    across the surface, because uniform scattering is what makes a blur look
    like a blur.
  */
  float thickness = 0.45 + 0.55 * (fbm(uv * (7.0 + uGrain * 10.0), 2) * 0.5 + 0.5);
  float rad = mix(0.010, 0.032, thickness);
  vec3 scat = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ang = fi * 2.3999632297 + uPhase * 6.0;
    float rr = sqrt((fi + 0.5) / 6.0) * rad;
    vec2 off = vec2(cos(ang), sin(ang)) * rr + hash2(uv * 320.0 + fi) * rad * 0.5;
    vec2 sp = (p + off) * (0.62 + 0.38 / (z + 0.42));
    float b = fbm(sp * (1.2 + uWarp * 1.8) + 2.2 * q + uPhase * 12.0, 3);
    float ii = pow(clamp(b * 0.5 + 0.5, 0.0, 1.0), 1.35) * (0.55 + 0.85 * uGlow);
    // channels scatter at slightly different radii — the prismatic fringe
    scat += spectrum(hue + (b * 0.5) * (0.06 + uSpread * 0.42)) * ii
            * vec3(1.06, 1.0, 0.94);
  }
  outc = mix(outc, ground + scat / 6.0 * 1.75, 0.55);

  // the tooth of the glass
  outc += (hash1(uv * 900.0) - 0.5) * 0.035;

  // rim light, and one specular highlight so it reads as a solid object
  float rim = pow(1.0 - z, 2.6);
  outc += vec3(0.62, 0.66, 0.82) * rim * 0.34;
  float spec = pow(max(0.0, dot(normalize(n), normalize(vec3(-0.45, 0.62, 0.70)))), 22.0);
  outc += vec3(1.0) * spec * 0.30;

  // the shadowed underside keeps it from looking like a sticker
  outc *= 0.82 + 0.18 * smoothstep(-0.9, 0.5, -p.y + z * 0.5);

  frag = vec4(outc, edge);
}`;

interface Renderer {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
}

let shared: Renderer | null = null;
let sharedFailed = false;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[marble] shader failed:", gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: true,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true, // needed to read the pixels back out
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("[marble] link failed:", gl.getProgramInfoLog(prog));
    return null;
  }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const names = ["uHue", "uSpread", "uWarp", "uGrain", "uGlow", "uPhase", "uTime"];
  const loc: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) loc[n] = gl.getUniformLocation(prog, n);

  return { gl, canvas, prog, loc };
}

export function drawMarble(r: Renderer, m: Marble, timeSec: number) {
  const { gl, loc } = r;
  gl.viewport(0, 0, r.canvas.width, r.canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(r.prog);
  gl.uniform1f(loc.uHue, m[0]);
  gl.uniform1f(loc.uSpread, m[1]);
  gl.uniform1f(loc.uWarp, m[2]);
  gl.uniform1f(loc.uGrain, m[3]);
  gl.uniform1f(loc.uGlow, m[4]);
  gl.uniform1f(loc.uPhase, m[5]);
  gl.uniform1f(loc.uTime, timeSec);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function getShared(): Renderer | null {
  if (shared || sharedFailed) return shared;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  shared = createRenderer(canvas);
  if (!shared) sharedFailed = true;
  return shared;
}

/* Bitmaps are small and reused across every list that shows the same track,
   so a modest cache covers a whole session. */
const CACHE = new Map<string, string>();
const CACHE_MAX = 240;

/**
 * A marble as a data URL, drawn once and remembered.
 * Returns null where WebGL is unavailable; the caller paints CSS instead.
 */
export function marbleImage(m: Marble, sizePx: number): string | null {
  const key = `${sizePx}|${m.map((n) => n.toFixed(4)).join(",")}`;
  const hit = CACHE.get(key);
  if (hit) return hit;

  const r = getShared();
  if (!r) return null;

  const px = Math.max(16, Math.min(512, Math.round(sizePx)));
  if (r.canvas.width !== px || r.canvas.height !== px) {
    r.canvas.width = px;
    r.canvas.height = px;
  }
  try {
    // A fixed time: a still marble must be the same still every time, or it
    // would flicker between renders of the same track.
    drawMarble(r, m, 0);
    const url = r.canvas.toDataURL("image/png");
    if (CACHE.size >= CACHE_MAX) {
      const oldest = CACHE.keys().next().value;
      if (oldest) CACHE.delete(oldest);
    }
    CACHE.set(key, url);
    return url;
  } catch (err) {
    console.error("[marble] render failed", err);
    sharedFailed = true;
    shared = null;
    return null;
  }
}

/** A plain CSS approximation, for no-WebGL and for the first paint. */
export function marbleCss(m: Marble): string {
  const hue = (h: number) => Math.round(188 + h * 172);
  const a = hue(m[0]);
  const b = hue((m[0] + m[1] * 0.4) % 1);
  const light = 52 + m[4] * 16;
  return [
    `radial-gradient(60% 55% at 38% 32%, hsl(${a} 72% ${light + 14}% / 0.95), transparent 70%)`,
    `radial-gradient(70% 66% at 68% 66%, hsl(${b} 66% ${light}% / 0.85), transparent 72%)`,
    `radial-gradient(120% 120% at 50% 50%, #17142c, #0a0817)`,
  ].join(", ");
}
