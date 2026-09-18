"use client";

/*
  Aurora behind frosted glass, rendered per-pixel on the GPU.

  Why a shader and not CSS: the two things this image has to do are a
  continuous iridescent colour field and real frosted glass, and neither
  survives being approximated. Stacked gradients give you stripes where
  there should be a field, and `blur()` gives you a smear where there
  should be scattering. Frosted glass does not blur what is behind it — it
  scatters it, sampling in a thousand slightly wrong directions at once,
  which is why it looks granular and crystalline rather than soft. That is
  a per-pixel operation.

  Two passes:

    1  the aurora field, drawn at half resolution into a framebuffer.
       Half res is not a compromise — frost destroys fine detail anyway, so
       resolving detail the second pass will scatter away is wasted work.

    2  the glass. Samples pass 1 through a noise-jittered kernel whose
       radius itself varies across the surface, so the scatter is uneven
       the way real frost is. Each channel scatters at a slightly different
       radius, which is what gives frosted glass its faint prismatic
       fringing. Then surface grain, sparse micro-glints off the facets,
       and a broad sheen.

  The palette is sampled from the reference photograph: cyan through blue
  and violet into magenta, pink and a little peach, with no green — real
  aurora over water, not a rainbow.
*/

import { useEffect, useRef, useState } from "react";

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

/* ---- pass 1: the aurora field ---------------------------------------- */

const FIELD_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform vec2 uRes;
uniform float uTime;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

/* gradient noise — smoother and less grid-locked than value noise */
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
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 7; i++) {
    if (i >= octaves) break;
    sum += amp * gnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return sum;
}

/*
  Sampled from the reference. Pastel rather than neon — an aurora is pale
  light, and saturating it reads as a gradient mesh. No green: the
  reference has almost none, and adding it turns this into a rainbow.
*/
vec3 spectrum(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.494, 0.831, 0.910); // pale cyan
  vec3 c1 = vec3(0.498, 0.659, 0.910); // blue
  vec3 c2 = vec3(0.604, 0.549, 0.902); // blue-violet
  vec3 c3 = vec3(0.725, 0.541, 0.871); // violet
  vec3 c4 = vec3(0.867, 0.561, 0.816); // magenta
  vec3 c5 = vec3(0.949, 0.627, 0.741); // pink
  vec3 c6 = vec3(0.965, 0.765, 0.651); // peach
  if (t < 0.17) return mix(c0, c1, smoothstep(0.0, 0.17, t));
  if (t < 0.38) return mix(c1, c2, smoothstep(0.17, 0.38, t));
  if (t < 0.56) return mix(c2, c3, smoothstep(0.38, 0.56, t));
  if (t < 0.73) return mix(c3, c4, smoothstep(0.56, 0.73, t));
  if (t < 0.88) return mix(c4, c5, smoothstep(0.73, 0.88, t));
  return mix(c5, c6, smoothstep(0.88, 1.0, t));
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float t = uTime;

  /*
    Curtain coordinates: compressed horizontally and stretched vertically,
    so the structure runs in vertical draperies. This is where the "lines"
    come from — as texture inside the colour, not as drawn strokes.
  */
  vec2 cp = vec2(p.x * 3.1, p.y * 0.62);

  // two rounds of domain warping: what makes the folds look grown, not drawn
  vec2 q = vec2(fbm(cp + vec2(0.0, t * 0.021), 4),
                fbm(cp + vec2(5.2, 1.3) - vec2(0.0, t * 0.017), 4));
  vec2 r = vec2(fbm(cp + 2.6 * q + vec2(1.7, 9.2) + vec2(0.0, t * 0.013), 4),
                fbm(cp + 2.6 * q + vec2(8.3, 2.8) - vec2(0.0, t * 0.011), 4));
  float body = fbm(cp + 3.1 * r, 5);

  // fine vertical striation: detail within the light, deliberately low contrast
  float striate = fbm(vec2(p.x * 46.0, p.y * 1.6 + t * 0.02), 3);
  float veil = fbm(vec2(p.x * 13.0, p.y * 2.4 - t * 0.014), 3);

  // where the curtain actually is — a soft vertical band, brightest mid-height
  float column = exp(-pow(abs(p.x) * 0.70, 2.8));
  float height = smoothstep(-0.52, -0.05, p.y) * smoothstep(0.54, 0.02, p.y);

  float intensity = (body * 0.5 + 0.5);
  intensity = pow(clamp(intensity, 0.0, 1.0), 1.55);
  intensity *= column * height;
  intensity *= 0.80 + 0.20 * (striate * 0.5 + 0.5);
  intensity *= 0.86 + 0.14 * (veil * 0.5 + 0.5);

  /*
    Hue runs across the field, nudged by the same warp that shapes it, so
    colour and form belong to one another instead of colour being painted
    on afterwards.
  */
  float hueT = 0.5 + p.x * 1.25 + r.x * 0.38 + body * 0.14;
  vec3 col = spectrum(hueT);

  // hot cores go pale, as real aurora does where it is brightest
  float core = smoothstep(0.42, 0.95, intensity);
  col = mix(col, mix(col, vec3(1.0), 0.48), core);

  // deep indigo ground, lifting toward the cloud bank at the base
  vec3 ground = mix(vec3(0.043, 0.035, 0.106), vec3(0.129, 0.125, 0.212),
                    smoothstep(0.1, 1.0, uv.y));

  vec3 outc = ground + col * intensity * 2.15;

  // a low cloud catching the light from underneath
  float bank = smoothstep(0.30, 0.0, uv.y) * (0.5 + 0.5 * fbm(vec2(p.x * 3.2, p.y * 5.0), 3));
  outc += vec3(0.30, 0.28, 0.38) * bank * 0.36;

  /*
    How thick the frost is here, carried in alpha. Computing it in this
    pass costs three octaves at HALF resolution; computing it in the glass
    pass would cost the same three octaves at full resolution, per pixel,
    for a value that varies far too slowly to need it.
  */
  float thickness = 0.5 + 0.5 * fbm(vec2(p.x * 7.0, p.y * 7.0) + vec2(0.0, t * 0.01), 3);

  frag = vec4(outc, thickness);
}`;

/* ---- pass 2: the glass ------------------------------------------------ */

const GLASS_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uField;
uniform vec2 uRes;
uniform float uTime;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123) * 2.0 - 1.0;
}

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

const int TAPS = 10;

void main() {
  vec2 uv = vUv;

  /*
    The scatter radius varies across the surface — frost is not uniform,
    it has thick and thin patches, and a constant radius is exactly what
    makes a blur look like a blur. Thickness comes from the field pass's
    alpha, computed once at half res rather than per pixel here.
  */
  float thickness = texture(uField, uv).a;
  float radius = mix(0.0018, 0.0060, thickness);

  /*
    The crystal field. A plain hash, not smooth noise: this only has to be
    random, and three octaves of gradient noise per pixel — twice — was by
    far the most expensive thing in this shader.
  */
  vec2 facet = hash2(floor(uv * 2200.0));

  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i);
    // golden-angle spiral: even coverage without a grid signature
    float ang = fi * 2.3999632297;
    float rad = sqrt((fi + 0.5) / float(TAPS));
    vec2 dir = vec2(cos(ang), sin(ang)) * rad;

    // jitter each tap by the crystal field -> granular, not gaussian
    vec2 jit = (hash2(uv * 512.0 + fi * 17.31) * 0.6 + facet * 1.2) * radius;
    vec2 off = dir * radius + jit;

    /*
      Each channel scatters at a slightly different radius. This is the
      faint prismatic fringing real frosted glass shows, and it is the
      single detail that separates it from a blur.
    */
    float w = 1.0 - rad * 0.35;
    acc.r += texture(uField, uv + off * 1.075).r * w;
    acc.g += texture(uField, uv + off).g * w;
    acc.b += texture(uField, uv + off * 0.925).b * w;
    wsum += w;
  }
  vec3 col = acc / max(wsum, 0.0001);

  // surface grain: the tooth of the glass, fine and achromatic
  float grain = hash1(uv * uRes * 0.85) - 0.5;
  col += grain * 0.028;

  /*
    Sparse glints off individual facets. Sampled on a coarse cell and given
    a soft radial falloff inside it — a hard threshold on a per-pixel hash
    produces single lit pixels, which read as dead pixels rather than light.
  */
  vec2 cell = uv * uRes / 7.0;
  vec2 cellId = floor(cell);
  vec2 cellUv = fract(cell) - 0.5;
  float pick = hash1(cellId);
  float glint = smoothstep(0.9965, 1.0, pick);
  float falloff = smoothstep(0.42, 0.0, length(cellUv));
  col += glint * falloff * (0.28 + 0.42 * thickness) * vec3(0.98, 0.97, 1.0);

  // broad sheen across the pane, and a little light pooling at the top
  float sheen = smoothstep(0.85, 0.0, distance(uv, vec2(0.34, 1.02)));
  col += vec3(0.86, 0.89, 0.95) * sheen * 0.055;

  // the pane frosts up toward its edges, as glass does
  float edge = smoothstep(0.32, 0.5, distance(uv, vec2(0.5)));
  col = mix(col, col * 0.86 + vec3(0.055, 0.05, 0.075), edge * 0.7);

  frag = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[aurora] shader failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function program(gl: WebGL2RenderingContext, frag: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("[aurora] link failed:", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

export function AuroraGlass({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      setFailed(true);
      return;
    }

    const fieldProg = program(gl, FIELD_FRAG);
    const glassProg = program(gl, GLASS_FRAG);
    if (!fieldProg || !glassProg) {
      setFailed(true);
      return;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // the field is drawn here, then scattered by the glass pass
    const fieldTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fieldTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const uField = {
      res: gl.getUniformLocation(fieldProg, "uRes"),
      time: gl.getUniformLocation(fieldProg, "uTime"),
    };
    const uGlass = {
      res: gl.getUniformLocation(glassProg, "uRes"),
      time: gl.getUniformLocation(glassProg, "uTime"),
      field: gl.getUniformLocation(glassProg, "uField"),
    };

    let w = 0;
    let h = 0;
    let fw = 0;
    let fh = 0;

    const resize = () => {
      // Cap the device pixel ratio: past 2x nobody can see the difference
      // in something this soft, and the fill cost is quadratic.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const nw = Math.max(1, Math.round(rect.width * dpr));
      const nh = Math.max(1, Math.round(rect.height * dpr));
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      canvas.width = w;
      canvas.height = h;
      // half res for the field: the glass scatters away anything finer
      fw = Math.max(1, Math.round(w * 0.5));
      fh = Math.max(1, Math.round(h * 0.5));
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    };

    const draw = (tSec: number) => {
      resize();

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, fw, fh);
      gl.useProgram(fieldProg);
      gl.uniform2f(uField.res, fw, fh);
      gl.uniform1f(uField.time, tSec);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(glassProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uGlass.field, 0);
      gl.uniform2f(uGlass.res, w, h);
      gl.uniform1f(uGlass.time, tSec);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = false;
    const start = performance.now();

    /*
      Adaptive guard. There is no way to know from here whether this is a
      desktop GPU or a five-year-old phone, and a hero running at twelve
      frames a second is worse than one that does not move at all. So:
      watch the first stretch of real frames, and if the device cannot hold
      a reasonable rate, keep the image and stop animating it. Measured, not
      guessed from a user-agent string.
    */
    let probe = 0;
    let probeTotal = 0;
    let last = performance.now();
    const PROBE_FRAMES = 45;
    const PROBE_SKIP = 8; // ignore the first frames: shader compile, warm-up
    const BUDGET_MS = 26;

    const loop = () => {
      const now = performance.now();
      draw((now - start) / 1000);

      if (probe < PROBE_FRAMES) {
        probe++;
        if (probe > PROBE_SKIP) probeTotal += now - last;
        if (probe === PROBE_FRAMES) {
          const mean = probeTotal / (PROBE_FRAMES - PROBE_SKIP);
          if (mean > BUDGET_MS) {
            console.info(
              `[aurora] ${mean.toFixed(1)}ms/frame — holding a still frame instead`
            );
            running = false;
            cancelAnimationFrame(raf);
            return;
          }
        }
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };

    const play = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // one frame regardless, so a still image is always correct
    draw(0);

    // don't burn a GPU on something scrolled out of view or in a hidden tab
    const io = new IntersectionObserver(
      ([e]) => (e.isIntersecting && !document.hidden ? play() : pause()),
      { threshold: 0.01 }
    );
    io.observe(canvas);
    const onVis = () => (document.hidden ? pause() : play());
    document.addEventListener("visibilitychange", onVis);

    const onLost = (e: Event) => {
      e.preventDefault();
      pause();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      pause();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteProgram(fieldProg);
      gl.deleteProgram(glassProg);
      gl.deleteBuffer(quad);
      gl.deleteTexture(fieldTex);
      gl.deleteFramebuffer(fbo);
    };
  }, []);

  return (
    <div className={`echo-aurora ${className}`}>
      {/* Painted stand-in: what shows before the first frame, and all that
          shows without WebGL. Same palette, no pretence of being the real
          thing. */}
      <div className="echo-aurora-fallback" />
      {!failed && <canvas ref={ref} className="echo-aurora-canvas" />}
    </div>
  );
}
