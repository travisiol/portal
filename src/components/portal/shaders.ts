/**
 * GLSL for the portal's energy surface and the particle field. Procedural
 * only — no textures are loaded. Simplex noise after Ian McEwan / Ashima Arts
 * (MIT), the usual compact form.
 */
export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return v;
}
`;

export const ENERGY_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The energy surface: a spacetime lattice (fine polar grid) warped by noise,
 * lensed toward the centre, with concentric ripples and a core bloom. Every
 * term scales with uEnergy so the dormant portal is almost black and the open
 * portal is a full distortion field. uFlash is the burst on completion.
 */
export const ENERGY_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uEnergy;
uniform float uFlash;
uniform float uSweep;
uniform float uSweepAngle;
uniform vec2 uPointer;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;
${NOISE_GLSL}
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float e = clamp(uEnergy, 0.0, 1.0);

  // gravitational lensing: pull the field toward the centre as energy rises
  float lens = e * 0.45 * (1.0 - smoothstep(0.0, 1.0, r));
  vec2 q = p * (1.0 - lens);
  q += uPointer * 0.06 * e;

  // noise warp
  float n1 = fbm(q * 2.6 + vec2(uTime * 0.11, -uTime * 0.07));
  float n2 = fbm(q * 2.6 + vec2(-uTime * 0.09, uTime * 0.13) + 5.0);
  q += vec2(n1, n2) * (0.05 + 0.18 * e);

  float rr = length(q);
  float a = atan(q.y, q.x);

  // spacetime lattice
  float ringLine = abs(fract(rr * 9.0 - uTime * 0.35 * e) - 0.5);
  float rings = smoothstep(0.06, 0.0, ringLine) * 0.9;
  float spokeLine = abs(fract(a / 6.28318 * 28.0) - 0.5);
  float spokes = smoothstep(0.08, 0.0, spokeLine) * 0.6;
  float lattice = max(rings, spokes) * (0.10 + 0.75 * e) * smoothstep(1.0, 0.4, r);

  // ripples travelling inward
  float ripple = 0.5 + 0.5 * sin(rr * 34.0 - uTime * (2.0 + 4.0 * e));
  ripple *= e * 0.28 * smoothstep(0.95, 0.15, rr) * (0.5 + 0.5 * n1);

  // core
  // event horizon: a dark well the lattice falls into, brightest just around it
  float well = smoothstep(0.0, 0.22, rr) * (1.0 - smoothstep(0.22, 0.42, rr));
  float core = exp(-rr * rr * (9.0 - 3.0 * e)) * (0.08 + 0.7 * e + uFlash * 2.0) + well * e * 0.45;

  // nebula body
  float body = (fbm(q * 1.8 - uTime * 0.05) * 0.5 + 0.5);
  vec3 col = vec3(0.012, 0.016, 0.02);
  col = mix(col, uColorA * 0.34, body * (0.08 + 0.38 * e));
  col += uColorA * lattice;
  col += uColorB * ripple;
  col += mix(uColorA, uColorB, 0.6) * core;
  col += uColorB * uFlash * 0.8 * smoothstep(1.0, 0.0, r);

  // in transit: a radar sweep with a fading trail circles the surface until the asset arrives
  float trail = pow(1.0 - fract((uSweepAngle - a) / 6.28318), 3.0);
  col += uColorB * trail * uSweep * 1.1 * smoothstep(1.0, 0.3, r) * smoothstep(0.12, 0.4, r);

  // fade to the bezel
  float edge = smoothstep(1.0, 0.9, r);
  col *= edge;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const PARTICLE_VERTEX = /* glsl */ `
attribute float aSeed;
attribute float aSpeed;
attribute float aSize;
attribute float aAngle;
uniform float uTime;
uniform float uEnergy;
uniform float uSweep;
uniform float uPixelRatio;
varying float vAlpha;
void main() {
  float e = clamp(uEnergy, 0.0, 1.0);
  float t = fract(aSeed + uTime * aSpeed * (0.05 + 0.35 * e + 0.45 * uSweep));
  // pulled inward: radius shrinks from beyond the bezel to the core
  float radius = mix(1.9, 0.04, t * t);
  float angle = aAngle + t * (1.2 + 2.5 * e) + uTime * 0.05;
  vec3 pos = vec3(cos(angle) * radius, sin(angle) * radius, 0.02 + 0.35 * (1.0 - t) * sin(aSeed * 40.0));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio * (0.4 + 1.6 * (1.0 - t)) * (16.0 / -mv.z);
  vAlpha = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.85, 1.0, t)) * (0.05 + 0.95 * e);
}
`;

export const PARTICLE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float disc = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(uColor, disc * vAlpha);
}
`;
