// Opal-Verlauf: ein ruhiger WebGL2-Hintergrund in Röstfarben, der dem Zeiger nachgibt.
// Ohne WebGL2 bleibt der CSS-Verlauf darunter sichtbar.

const CONFIG = {
  bgColor: '#070707', colorA: '#110b07', colorB: '#2c1a11', colorC: '#6e3e22', colorD: '#c69b6e',
  scale: 0.5, speed: 0.12, flow: 0.16, warp: 1.45, warpScale: 0.75,
  roughness: 0.45, lacunarity: 2, thickness: 1.2, iridescence: 0.22, spread: 0.28,
  sheen: 0.05, contrast: 1.35, midpoint: 0.54, glow: 0.08, sink: 0.35,
  grain: 0.045, grainAnim: 1, dither: 1.55, vignette: 0.26,
  // Der Verlauf ist weich: Eine Leinwand in einfacher Auflösung genügt und kostet auf dichten Bildschirmen weniger als die Hälfte.
  cursor: 1, pointerRadius: 0.3, pointerStrength: 1.2, parallax: 0.01, maxDpr: 1,
};

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2  iResolution;
uniform float iTime;
uniform vec2  iMouse;
uniform vec2  iMouseVel;
uniform vec2  iMouseWake;
uniform vec3  uBgColor, uColorA, uColorB, uColorC, uColorD;
uniform float uScale, uSpeed, uFlow, uWarp, uWarpScale;
uniform float uRoughness, uLacunarity, uThickness, uIridescence, uSpread;
uniform float uSheen, uContrast, uMidpoint, uGlow, uSink;
uniform float uGrain, uDither, uVignette, uPointerRadius, uPointerStrength;
uniform float uParallax;
#define TRAIL_TAPS 6
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float snoise(vec2 p) {
  const float K1 = 0.366025404, K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}
float trail(vec2 uv, float radius) {
  vec2 wob = vec2(snoise(uv * 1.7 + vec2(0.0, iTime * 0.05)),
                  snoise(uv * 1.7 + vec2(4.3, -iTime * 0.04)));
  uv += wob * radius * 0.22;
  float a = 0.0, wsum = 0.0;
  float r2 = max(1e-4, radius * radius);
  for (int i = 0; i < TRAIL_TAPS; i++) {
    float k = float(i) / float(TRAIL_TAPS - 1);
    vec2 c = mix(iMouseWake, iMouse, k);
    vec2 dd = uv - c;
    float w = mix(0.28, 1.0, k);
    a += w * exp(-dot(dd, dd) / r2);
    wsum += w;
  }
  return a / wsum;
}
vec3 ramp4(float t) {
  vec3 c = mix(uColorA, uColorB, smoothstep(0.00, 0.36, t));
  c = mix(c, uColorC, smoothstep(0.32, 0.70, t));
  c = mix(c, uColorD, smoothstep(0.66, 1.00, t));
  return c;
}
float tone(float x) { return 0.5 + 0.5 * tanh((x - uMidpoint) * uContrast * 2.2); }
float triDither(vec2 fc) {
  float a = fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(fc + 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  return (a + b - 1.0) / 255.0;
}
#define OCT 3
float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < OCT; i++) { v += amp * snoise(p); p = p * uLacunarity + vec2(6.1, 2.7); amp *= uRoughness; }
  return v;
}
uniform float uGrainAnim;
float houseGrain(vec2 fc) {
  uvec2 q = uvec2(fc) * uvec2(1597334677u, 3812015801u)
          + uint(floor(iTime * 24.0 * uGrainAnim)) * 2654435769u;
  uint n = q.x ^ q.y; n = n * 1664525u + 1013904223u; n ^= n >> 16u; n *= 2246822519u; n ^= n >> 13u;
  float a = float(n & 0xffffu) / 65535.0;
  n *= 3266489917u; n ^= n >> 16u;
  float b = float(n & 0xffffu) / 65535.0;
  return a + b - 1.0;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution) / iResolution.y;
  float t = iTime * uSpeed;
  float tr = trail(uv, uPointerRadius);
  vec2 p = (uv - iMouse * uParallax) * uScale;
  vec2 q = vec2(fbm(p * uWarpScale + vec2(0.0, t * uFlow)),
                fbm(p * uWarpScale + vec2(5.2, 1.3) - t * uFlow * 0.7));
  float base = fbm(p + uWarp * q + vec2(t * 0.12, -t * 0.09)) * 0.5 + 0.5;
  float thick = base * uThickness + tr * uPointerStrength;
  vec3 film = 0.5 + 0.5 * cos(6.28318 * (thick * vec3(1.0, 1.0 - uSpread * 0.18, 1.0 - uSpread * 0.36)
                                         + vec3(0.0, 0.08, 0.16)));
  float f = tone(base);
  vec3 col = ramp4(f);
  col *= mix(vec3(1.0), film * 1.25, uIridescence);
  col += uColorD * (uGlow * pow(f, 4.0) + uSheen * pow(film.g, 6.0) * 0.25);
  col = mix(uBgColor, col, smoothstep(0.0, max(0.01, uSink), f) * 0.90 + 0.10);
  col *= 1.0 - uVignette * dot(uv, uv);
  { float hgL = clamp(dot(col, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    col += houseGrain(gl_FragCoord.xy) * uGrain * mix(1.0, 4.0 * hgL * (1.0 - hgL), 0.6); }
  col += triDither(gl_FragCoord.xy) * uDither;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const hexToVec3 = (h) => {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
};

// Hängt den Verlauf an ein Canvas. Gibt false zurück, wenn WebGL2 fehlt.
export function opalStarten(canvas, reduziert) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  } catch { gl = null; }
  if (!gl) return false;

  let program = null, vs = null, fs = null, vao = null, rafId = 0, locations = {};
  const loc = (n) => {
    if (!program) return null;
    if (!(n in locations)) locations[n] = gl.getUniformLocation(program, n);
    return locations[n];
  };
  const u1f = (n, v) => gl.uniform1f(loc(n), v);
  const u2f = (n, x, y) => gl.uniform2f(loc(n), x, y);
  const u3c = (n, hex) => { const c = hexToVec3(hex); gl.uniform3f(loc(n), c[0], c[1], c[2]); };
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'Shader');
    return sh;
  };
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);
    u2f('iResolution', w, h);
  };
  const applyConfig = () => {
    gl.useProgram(program);
    u3c('uBgColor', CONFIG.bgColor); u3c('uColorA', CONFIG.colorA); u3c('uColorB', CONFIG.colorB);
    u3c('uColorC', CONFIG.colorC); u3c('uColorD', CONFIG.colorD);
    const zahlen = {
      uScale: 'scale', uSpeed: 'speed', uFlow: 'flow', uWarp: 'warp', uWarpScale: 'warpScale',
      uRoughness: 'roughness', uLacunarity: 'lacunarity', uThickness: 'thickness', uIridescence: 'iridescence',
      uSpread: 'spread', uSheen: 'sheen', uContrast: 'contrast', uMidpoint: 'midpoint', uGlow: 'glow', uSink: 'sink',
      uGrain: 'grain', uGrainAnim: 'grainAnim', uDither: 'dither', uVignette: 'vignette',
      uPointerRadius: 'pointerRadius', uPointerStrength: 'pointerStrength', uParallax: 'parallax',
    };
    for (const [u, k] of Object.entries(zahlen)) u1f(u, CONFIG[k]);
    u1f('iTime', 3.2);
    u2f('iMouse', 0, 0); u2f('iMouseVel', 0, 0); u2f('iMouseWake', 0, 0);
    resize();
  };
  const build = () => {
    if (program) gl.deleteProgram(program);
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    if (vao) gl.deleteVertexArray(vao);
    locations = {};
    vs = compile(gl.VERTEX_SHADER, VERT);
    fs = compile(gl.FRAGMENT_SHADER, FRAG);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Link');
    gl.useProgram(program);
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
  };
  const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  const mouse = { x: 0, y: 0, ax: 0, ay: 0, wx: 0, wy: 0, tx: 0, ty: 0 };
  const aim = (e) => {
    const r = canvas.getBoundingClientRect();
    if (!r.height) return;
    mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * (r.width / r.height);
    mouse.ty = 0.5 - (e.clientY - r.top) / r.height;
  };

  let visible = false;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(canvas);

  let prevT = performance.now();
  let clock = 3.2;
  const frame = (now) => {
    rafId = requestAnimationFrame(frame);
    const raw = now - prevT;
    prevT = now;
    if (!visible || document.hidden) return;
    const ms = raw > 50 ? 50 : raw < 4.167 ? 4.167 : raw;
    const s = ms > 36.7 ? 2.2 : ms * 0.06;
    clock += ms * 0.001;
    const kLead = 0.105 * s, kBody = 0.043 * s, kWake = 0.017 * s;
    mouse.ax += (mouse.tx - mouse.ax) * kLead;
    mouse.ay += (mouse.ty - mouse.ay) * kLead;
    mouse.x += (mouse.ax - mouse.x) * kBody;
    mouse.y += (mouse.ay - mouse.y) * kBody;
    mouse.wx += (mouse.x - mouse.wx) * kWake;
    mouse.wy += (mouse.y - mouse.wy) * kWake;
    u1f('iTime', clock);
    u2f('iMouse', mouse.x, mouse.y);
    u2f('iMouseVel', mouse.ax - mouse.x, mouse.ay - mouse.y);
    u2f('iMouseWake', mouse.wx, mouse.wy);
    draw();
  };

  let queued = false;
  const ro = new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; resize(); if (reduziert) draw(); });
  });
  ro.observe(canvas);

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(rafId); });
  canvas.addEventListener('webglcontextrestored', () => {
    build(); applyConfig(); draw();
    if (!reduziert) rafId = requestAnimationFrame(frame);
  });

  try {
    build();
    applyConfig();
  } catch (fehler) {
    console.warn('Verlauf nicht verfügbar', fehler);
    return false;
  }
  if (!reduziert) {
    window.addEventListener('pointermove', aim, { passive: true });
    window.addEventListener('pointerdown', aim, { passive: true });
  }
  draw();
  canvas.classList.add('ist-bereit');
  if (!reduziert) rafId = requestAnimationFrame(frame);
  return true;
}
