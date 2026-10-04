/**
 * GLSL for the architectural scene (WebGL2, GLSL ES 3.00).
 *
 * Note for editors: the repository's copy scan reads multi-word string literals
 * as copy, and these template literals count. Spell any comment inside the GLSL
 * the Indian English way, and name variables `tint`/`col` rather than the US
 * spelling of colour.
 *
 * Lighting model, in linear light:
 *  - blue-hour sky: a cool hemisphere, a warm afterglow low on one side;
 *  - a soft cool key from the upper left and a warm rim from behind;
 *  - interior rooms by interior mapping — each window cell is a real box behind
 *    the glass, so rooms shift with parallax as the camera moves;
 *  - the sweep: a thin sheet of light that crosses the facade and leaves the
 *    structure lit behind it;
 *  - height fog for atmospheric depth, ACES tone mapping, dither against banding.
 */

const COMMON = /* glsl */ `#version 300 es
precision highp float;
uniform vec3 uCamPos;
uniform float uTime;
uniform vec3 uSweepN;
uniform float uSweepPos;
uniform float uSweepGain;
uniform float uRevealAll;
uniform float uWindows;
uniform float uCity;
uniform float uFogDensity;
uniform float uExposure;
uniform float uLift;
uniform vec3 uKeyDir;
uniform vec3 uRimDir;

const vec3 KEY = vec3(0.46, 0.55, 0.68);
const vec3 RIM = vec3(1.0, 0.68, 0.44);
const vec3 SWEEP = vec3(1.0, 0.93, 0.82);
const vec3 SKY_TOP = vec3(0.0030, 0.0068, 0.0086);
const vec3 SKY_MID = vec3(0.0105, 0.0215, 0.0245);
const vec3 SKY_LOW = vec3(0.052, 0.066, 0.068);
const vec3 GLOW = vec3(0.13, 0.088, 0.058);
const vec3 HAZE = vec3(0.024, 0.032, 0.036);

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

vec3 skyTint(vec3 d) {
  float h = d.y;
  vec3 s = mix(SKY_LOW, SKY_MID, smoothstep(0.0, 0.16, h));
  s = mix(s, SKY_TOP, smoothstep(0.14, 0.75, h));
  vec2 flat2 = normalize(vec2(d.x, d.z) + 1e-5);
  float side = max(dot(flat2, normalize(uRimDir.xz)), 0.0);
  s += GLOW * pow(side, 2.5) * exp(-max(h, 0.0) * 8.0) * (0.55 + 0.45 * side);
  if (h < 0.0) s = mix(s, HAZE * 0.8, smoothstep(0.0, -0.08, h));
  return s;
}

float sweepDist(vec3 p) { return dot(p, uSweepN) - uSweepPos; }

float sweepBand(vec3 p) {
  float s = sweepDist(p);
  return (exp(-(s * s) / 0.018) + 0.22 * exp(-(s * s) / 1.1)) * uSweepGain;
}

float revealed(vec3 p) {
  return max(smoothstep(0.6, -5.0, sweepDist(p)), uRevealAll);
}

vec3 hemi(vec3 n) {
  return mix(vec3(0.0095, 0.0085, 0.0075), vec3(0.018, 0.028, 0.034), n.y * 0.5 + 0.5);
}

vec3 applyFog(vec3 c, vec3 p) {
  float dist = length(p - uCamPos);
  float low = exp(-max(p.y, 0.0) * 0.014);
  float f = 1.0 - exp(-dist * uFogDensity * (0.5 + 0.8 * low));
  vec3 v = normalize(p - uCamPos);
  vec3 fogTint = HAZE + GLOW * 0.35 * pow(max(dot(normalize(v.xz + 1e-5), normalize(uRimDir.xz)), 0.0), 3.0);
  return mix(c, fogTint, clamp(f, 0.0, 1.0));
}

vec3 toneMap(vec3 c) {
  c *= uExposure * (1.0 + 2.2 * uLift);
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
  float grey = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(c, vec3(grey) * 0.35 + vec3(0.62, 0.61, 0.59), uLift * 0.45);
}

`;

/** Fragment stages only: gl_FragCoord does not exist in a vertex shader. */
const FINISH = /* glsl */ `
vec3 finish(vec3 c) {
  c = toneMap(c);
  return c + (hash12(gl_FragCoord.xy + fract(uTime * 7.0) * 61.0) - 0.5) / 255.0;
}
`;

// ---------------------------------------------------------------------------
// Sky: a full-screen triangle, drawn first.
// ---------------------------------------------------------------------------

export const SKY_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vNdc;
void main() {
  vNdc = aPos;
  gl_Position = vec4(aPos, 1.0, 1.0);
}
`;

export const SKY_FRAGMENT = `${COMMON}${FINISH}
uniform mat4 uInvViewProj;
in vec2 vNdc;
out vec4 fragOut;
void main() {
  vec4 far4 = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(far4.xyz / far4.w - uCamPos);
  vec3 c = skyTint(dir);
  fragOut = vec4(finish(c), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Architecture: the tower, the city blocks and the balcony glass.
// Material ids: 0 concrete, 1 glass, 2 lobby, 3 metal, 4 city, 5 rail glass.
// ---------------------------------------------------------------------------

export const ARCH_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNrm;
layout(location = 2) in vec2 aAttr;
uniform mat4 uViewProj;
out vec3 vPos;
out vec3 vNrm;
out vec2 vAttr;
void main() {
  vPos = aPos;
  vNrm = aNrm;
  vAttr = aAttr;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;

export const ARCH_FRAGMENT = `${COMMON}${FINISH}
uniform float uInteriorDetail;
in vec3 vPos;
in vec3 vNrm;
in vec2 vAttr;
out vec4 fragOut;

const float HALF = 8.0;

vec3 interior(vec2 f, vec3 rd, vec2 cell, vec2 size, float depth, float share, float always) {
  float pick = hash12(cell + 0.37);
  float onAt = hash12(cell * 1.37 + 11.1) * 0.85;
  float lit = always > 0.5
    ? smoothstep(0.0, 0.2, uWindows)
    : step(pick, share) * smoothstep(onAt, onAt + 0.09, uWindows);
  vec3 warm = mix(vec3(1.0, 0.58, 0.29), vec3(1.0, 0.79, 0.57), hash12(cell + 3.7));
  float bright = mix(0.5, 1.3, hash12(cell + 8.3));

  vec3 box = vec3(size, depth);
  vec3 ro = vec3(f * size, 0.0);
  vec3 d = rd;
  d.x = abs(d.x) < 1e-4 ? 1e-4 : d.x;
  d.y = abs(d.y) < 1e-4 ? 1e-4 : d.y;
  d.z = max(d.z, 1e-3);
  vec3 tt = (step(0.0, d) * box - ro) / d;
  tt.z = depth / d.z;
  float t = min(min(tt.x, tt.y), tt.z);
  vec3 h = (ro + d * t) / box;

  float surf;
  if (t == tt.z) {
    surf = (0.5 + 0.5 * (1.0 - abs(h.x - 0.5) * 1.3)) * (0.55 + 0.45 * h.y);
    surf *= mix(0.4, 1.0, smoothstep(0.16, 0.3, h.y));
  } else if (t == tt.y) {
    surf = d.y < 0.0
      ? 0.22 + 0.22 * h.z
      : 0.3 + 1.5 * exp(-dot(h.xz - vec2(0.5, 0.42), h.xz - vec2(0.5, 0.42)) * 9.0);
  } else {
    surf = 0.34 + 0.28 * h.z;
  }
  surf = mix(0.55, surf, uInteriorDetail);
  vec3 on = warm * surf * bright * 1.7;
  float sheer = step(0.7, hash12(cell + 5.1));
  on = mix(on, warm * bright * 0.8, sheer * 0.6);
  vec3 off = vec3(0.004, 0.0055, 0.007) * (0.6 + h.z);
  return mix(off, on, lit);
}

vec3 shadeGlass(vec3 p, vec3 n, vec3 v, vec2 cellSize, float baseY, float depth, float share, float always) {
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 t = normalize(cross(up, n));
  vec2 uv = vec2(dot(p, t) + HALF, p.y - baseY);
  vec2 g = uv / cellSize;
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec3 rd = vec3(dot(v, t), dot(v, up), dot(v, -n));
  vec3 room = interior(f, rd, cell + n.xz * 37.0, cellSize, depth, share, always);

  float rev = revealed(p);
  vec3 r = reflect(v, n);
  float cosv = max(dot(-v, n), 0.0);
  float fres = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
  vec3 env = skyTint(r) * 1.7 + vec3(0.05, 0.038, 0.026) * exp(-abs(r.y) * 14.0) * uCity;
  vec3 c = room * (1.0 - fres) * 0.9 + env * fres * (0.3 + 0.7 * rev);
  vec3 hk = normalize(uKeyDir - v);
  c += KEY * pow(max(dot(n, hk), 0.0), 240.0) * 2.2 * rev;
  float band = sweepBand(p);
  c += SWEEP * band * (0.2 + 1.8 * fres);

  vec2 fw = fwidth(g);
  float q = fract(g.x * 2.0);
  float dx = min(q, 1.0 - q) * 0.5;
  float mw = 0.012;
  float mull = 1.0 - smoothstep(mw - fw.x, mw + fw.x, dx);
  float sill = 1.0 - smoothstep(0.012 - fw.y, 0.012 + fw.y, abs(f.y - 0.1));
  float m = max(mull, sill * 0.8);
  vec3 frame = vec3(0.018, 0.02, 0.022) + KEY * 0.06 * rev + SWEEP * band * 0.7;
  return mix(c, frame, m);
}

vec3 shadeConcrete(vec3 p, vec3 n, vec3 v) {
  vec3 alb = vec3(0.3, 0.285, 0.262) * (0.86 + 0.14 * noise(p.xz * 0.8 + p.y * 1.3));
  float rev = revealed(p);
  float ndl = max(dot(n, uKeyDir), 0.0);
  vec3 c = alb * (KEY * ndl * (0.08 + 0.92 * rev) * 0.62 + hemi(n) * (0.35 + 0.65 * rev));
  float rim = pow(1.0 - max(dot(-v, n), 0.0), 2.0) * max(dot(n, uRimDir), 0.0);
  c += RIM * rim * 0.2 * (0.3 + 0.7 * rev);
  if (n.y < -0.5) c += vec3(1.0, 0.6, 0.32) * 0.055 * uWindows;
  c += SWEEP * sweepBand(p) * alb * 1.25;
  c *= mix(0.55, 1.0, smoothstep(0.0, 4.0, p.y));
  return c;
}

vec3 shadeMetal(vec3 p, vec3 n, vec3 v) {
  float rev = revealed(p);
  vec3 hk = normalize(uKeyDir - v);
  float fres = 0.3 + 0.7 * pow(1.0 - max(dot(-v, n), 0.0), 5.0);
  vec3 c = vec3(0.03, 0.028, 0.025) * hemi(n) * 8.0;
  c += KEY * pow(max(dot(n, hk), 0.0), 70.0) * 0.7 * rev;
  c += skyTint(reflect(v, n)) * fres * 0.6;
  c += SWEEP * sweepBand(p) * 0.9;
  return c;
}

vec3 shadeCity(vec3 p, vec3 n, vec3 v, float seed) {
  if (abs(n.y) > 0.5) return vec3(0.011, 0.013, 0.014) + hemi(n) * 0.2;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 t = normalize(cross(up, n));
  vec2 g = vec2(dot(p, t) + seed * 53.0, p.y) / vec2(3.0, 3.3);
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec2 fw = fwidth(g);
  float wx = smoothstep(0.16 - fw.x, 0.16 + fw.x, f.x) * (1.0 - smoothstep(0.84 - fw.x, 0.84 + fw.x, f.x));
  float wy = smoothstep(0.24 - fw.y, 0.24 + fw.y, f.y) * (1.0 - smoothstep(0.82 - fw.y, 0.82 + fw.y, f.y));
  float win = wx * wy;
  float pick = hash12(cell + seed * 97.0);
  float onAt = hash12(cell * 0.71 + seed * 13.0) * 0.8;
  float lit = step(pick, 0.15) * smoothstep(onAt, onAt + 0.12, uCity);
  vec3 warm = mix(vec3(1.0, 0.6, 0.31), vec3(0.72, 0.82, 0.92), step(0.8, hash12(cell + seed)));
  vec3 wall = vec3(0.014, 0.016, 0.018) + hemi(n) * 0.45 + KEY * max(dot(n, uKeyDir), 0.0) * 0.018;
  vec3 pane = mix(skyTint(reflect(v, n)) * 0.55, warm * mix(0.6, 1.4, hash12(cell + 2.0)) * 1.3, lit);
  float detail = 1.0 - smoothstep(0.3, 0.85, max(fw.x, fw.y));
  vec3 c = mix(mix(wall, pane, 0.4), mix(wall, pane, win), detail);
  c += RIM * pow(1.0 - max(dot(-v, n), 0.0), 3.0) * max(dot(n, uRimDir), 0.0) * 0.05;
  return c;
}

void main() {
  vec3 n = normalize(vNrm);
  vec3 v = normalize(vPos - uCamPos);
  int m = int(vAttr.x + 0.5);
  vec3 c;
  float alpha = 1.0;
  if (m == 0) c = shadeConcrete(vPos, n, v);
  else if (m == 1) c = shadeGlass(vPos, n, v, vec2(3.2, 3.3), 6.0, 4.6, 0.4, 0.0);
  else if (m == 2) c = shadeGlass(vPos, n, v, vec2(4.0, 5.6), 0.3, 9.0, 1.0, 1.0);
  else if (m == 3) c = shadeMetal(vPos, n, v);
  else if (m == 4) c = shadeCity(vPos, n, v, vAttr.y);
  else {
    float fres = 0.04 + 0.96 * pow(1.0 - abs(dot(-v, n)), 5.0);
    c = skyTint(reflect(v, n)) * 1.4 * fres + vec3(0.02, 0.03, 0.032) + SWEEP * sweepBand(vPos) * 0.8;
    alpha = 0.16 + 0.55 * fres;
  }
  c = applyFog(c, vPos);
  fragOut = vec4(finish(c), alpha);
}
`;

// ---------------------------------------------------------------------------
// Ground: roads, pools of street light, spill from the lobby.
// ---------------------------------------------------------------------------

export const GROUND_VERTEX = /* glsl */ `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uViewProj;
out vec3 vPos;
void main() {
  vPos = aPos;
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;

export const GROUND_FRAGMENT = `${COMMON}${FINISH}
in vec3 vPos;
out vec4 fragOut;
float pool(float across, float along) {
  float lz = abs(mod(along, 26.0) - 13.0);
  float lx = abs(across - 7.0);
  return exp(-(lx * lx + lz * lz) / 38.0);
}
void main() {
  vec3 p = vPos;
  float dx = abs(mod(p.x, 110.0) - 55.0);
  float dz = abs(mod(p.z, 110.0) - 55.0);
  float road = 1.0 - smoothstep(8.5, 9.5, min(dx, dz));
  vec3 base = mix(vec3(0.0085, 0.0095, 0.0105), vec3(0.013, 0.014, 0.015), road);
  vec3 c = base * (0.6 + 0.4 * uRevealAll) + hemi(vec3(0.0, 1.0, 0.0)) * 0.15;
  float lamps = max(pool(dx, p.z), pool(dz, p.x));
  float near = exp(-length(p - uCamPos) / 260.0);
  c += vec3(1.0, 0.66, 0.36) * lamps * 0.13 * near * uCity;
  float r = length(p.xz);
  c += vec3(1.0, 0.68, 0.4) * exp(-r / 9.0) * 0.26 * smoothstep(0.0, 0.3, uWindows);
  c += SWEEP * sweepBand(p) * 0.08;
  c = applyFog(c, p);
  fragOut = vec4(finish(c), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Points: street lights and, on capable devices, dust in the light.
// aInfo: x kind (0 lamp, 1 dust), y seed, z size in metres.
// ---------------------------------------------------------------------------

export const POINTS_VERTEX = `${COMMON}
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aInfo;
uniform mat4 uViewProj;
uniform float uPixel;
uniform float uDust;
out vec3 vTint;
void main() {
  vec3 p = aPos;
  float seed = aInfo.y;
  float a;
  vec3 tint;
  if (aInfo.x > 0.5) {
    p += vec3(sin(uTime * 0.23 + seed * 6.28) * 0.5,
              sin(uTime * 0.11 + seed * 3.1) * 0.35 + uTime * 0.07,
              cos(uTime * 0.19 + seed * 5.0) * 0.5);
    float b = sweepBand(p);
    a = (0.035 + 0.9 * b) * uDust;
    tint = vec3(1.0, 0.95, 0.88) * (0.35 + 1.6 * b);
  } else {
    a = smoothstep(seed, seed + 0.18, uCity);
    tint = vec3(1.0, 0.7, 0.4) * 2.4;
  }
  float dist = length(p - uCamPos);
  a *= exp(-dist * uFogDensity * 0.55);
  a *= smoothstep(0.6, 2.5, dist);
  vTint = tint * a;
  gl_PointSize = clamp(aInfo.z * uPixel / dist, 1.5, 22.0);
  gl_Position = uViewProj * vec4(p, 1.0);
}
`;

export const POINTS_FRAGMENT = `${COMMON}
in vec3 vTint;
out vec4 fragOut;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float fall = exp(-dot(q, q) * 3.5);
  fragOut = vec4(toneMap(vTint) * fall, 1.0);
}
`;
