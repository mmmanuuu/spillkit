import type { Effect } from '../types';

export interface EdgeBulgeOptions {
  /** UV displacement strength along the outward normal. Default 0.22. */
  strength?: number;
  /** How far inside the edge (in UV units) the bulge falls off. Default 0.35. */
  falloff?: number;
}

const helpers = /* glsl */ `
uniform float uBulgeStrength;
uniform float uBulgeFalloff;

// Push UVs outward near the mask edge for a soft protruding / fisheye look.
vec2 spillEdgeBulge(vec2 uv) {
  if (uMaskEnabled < 0.5 || uBulgeStrength <= 0.0) return uv;

  vec2 fragPx = vec2(gl_FragCoord.x, gl_FragCoord.y);
  float sd = spillMaskSD(fragPx);

  // Inside: sd < 0. Near edge: sd approaches 0.
  float inside = 1.0 - smoothstep(-uBulgeFalloff * min(uMaskRect.z, uMaskRect.w), 0.0, sd);
  float edge = inside * (1.0 - smoothstep(-2.0, 0.0, sd));

  vec2 centerUv = vec2(0.5);
  vec2 dir = uv - centerUv;
  float len = length(dir);
  if (len < 1e-5) return uv;
  dir /= len;

  // Displace sample UV toward the center so the field appears to bulge out.
  return uv - dir * uBulgeStrength * edge;
}
`;

/**
 * Pre-effect: warp sample UVs near the masked edge (requires an active mask).
 */
export function edgeBulge(options: EdgeBulgeOptions = {}): Effect {
  const strength = options.strength ?? 0.22;
  const falloff = options.falloff ?? 0.35;

  return {
    stage: 'pre',
    helpers,
    pre: 'uv = spillEdgeBulge(uv);',
    uniforms: {
      uBulgeStrength: strength,
      uBulgeFalloff: falloff,
    },
  };
}

export const effects = {
  edgeBulge,
};
