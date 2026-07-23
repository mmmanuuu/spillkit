import type { Shader, UniformMap } from '../types';
import { hexToRgb } from '../utils/color';

export interface DomainWarpOptions {
  colors?: [string, string, string, string];
  speed?: number;
  warp?: number;
  scale?: number;
  grain?: number;
  saturation?: number;
  contrast?: number;
}

const DEFAULT_COLORS: [string, string, string, string] = [
  '#ffb25e',
  '#ff6f91',
  '#9d7bff',
  '#56d6ff',
];

/** Port of webgl-domain-warping: fbm → domain warp → OKLab mix → grain. */
const shade = /* glsl */ `
uniform float uTime;
uniform vec2  uResolution;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform float uSpeed;
uniform float uWarp;
uniform float uScale;
uniform float uGrain;
uniform float uSaturation;
uniform float uContrast;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                         + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                          dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 srgb2lin(vec3 c) { return pow(c, vec3(2.2)); }
vec3 lin2srgb(vec3 c) { return pow(c, vec3(1.0 / 2.2)); }

vec3 lin2oklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(l, 1.0 / 3.0);
  m = pow(m, 1.0 / 3.0);
  s = pow(s, 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 oklab2lin(vec3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return vec3(
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 mixOklab(vec3 a, vec3 b, float t) {
  vec3 la = lin2oklab(srgb2lin(a));
  vec3 lb = lin2oklab(srgb2lin(b));
  return lin2srgb(oklab2lin(mix(la, lb, clamp(t, 0.0, 1.0))));
}

vec3 adjustChroma(vec3 srgb, float s) {
  vec3 lab = lin2oklab(srgb2lin(srgb));
  lab.yz *= s;
  return lin2srgb(oklab2lin(lab));
}

float applyContrast(float m, float k) {
  return clamp((m - 0.5) * k + 0.5, 0.0, 1.0);
}

vec4 spillShade(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = uv;
  p.x *= aspect;
  p *= uScale;

  float t = uTime * uSpeed;

  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + t * 0.15),
    fbm(p + vec2(5.2, 1.3) - t * 0.12)
  );
  vec2 r = vec2(
    fbm(p + uWarp * q + vec2(1.7, 9.2) + t * 0.10),
    fbm(p + uWarp * q + vec2(8.3, 2.8) - t * 0.08)
  );
  float f = fbm(p + uWarp * r);

  float m0 = applyContrast(smoothstep(0.0, 1.0, f * 0.5 + 0.5), uContrast);
  float m1 = applyContrast(smoothstep(0.0, 1.0, length(r) * 0.7), uContrast);
  float m2 = applyContrast(smoothstep(0.0, 1.0, q.x * 0.5 + 0.5), uContrast);

  vec3 col = mixOklab(uColor0, uColor1, m0);
  col = mixOklab(col, uColor2, m1);
  col = mixOklab(col, uColor3, m2 * 0.6);
  col = adjustChroma(col, uSaturation);

  float g = fract(sin(dot(gl_FragCoord.xy + t, vec2(12.9898, 78.233))) * 43758.5453);
  col += (g - 0.5) * uGrain;

  return vec4(col, 1.0);
}
`;

export function domainWarp(options: DomainWarpOptions = {}): Shader {
  const colors = options.colors ?? DEFAULT_COLORS;
  const [c0, c1, c2, c3] = colors.map(hexToRgb);

  const uniforms: UniformMap = {
    uTime: 0,
    uResolution: [1, 1],
    uColor0: c0!,
    uColor1: c1!,
    uColor2: c2!,
    uColor3: c3!,
    uSpeed: options.speed ?? 0.21,
    uWarp: options.warp ?? 0.4,
    uScale: options.scale ?? 0.72,
    uGrain: options.grain ?? 0.02,
    uSaturation: options.saturation ?? 1.5,
    uContrast: options.contrast ?? 1.6,
  };

  return {
    shade,
    uniforms,
    update(t, u) {
      u.uTime = t;
    },
  };
}

export const shaders = {
  domainWarp,
};
