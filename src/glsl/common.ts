/** Fullscreen-triangle vertex shader for OGL `Triangle` geometry. */
export const defaultVertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * Rounded-rect SDF + soft alpha.
 * uMaskRect: x, y, w, h in gl_FragCoord space (origin bottom-left).
 * uMaskRadii[8]: TL.xy, TR.xy, BR.xy, BL.xy in the same pixel units.
 */
export const maskHelpers = /* glsl */ `
uniform vec4 uMaskRect;
uniform float uMaskRadii[8];
uniform float uMaskEnabled;

// Independent corner radii via quadrant pick (scalar r = max(rx, ry) per corner).
float sdRoundedRect(vec2 p, vec2 halfSize, vec4 radii) {
  // radii: x=TL, y=TR, z=BR, w=BL — p in center space, +Y up (gl_FragCoord).
  float r = (p.x > 0.0)
    ? (p.y > 0.0 ? radii.y : radii.z)
    : (p.y > 0.0 ? radii.x : radii.w);
  vec2 d = abs(p) - halfSize + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}

float spillMaskSD(vec2 fragPx) {
  vec2 center = uMaskRect.xy + uMaskRect.zw * 0.5;
  vec2 halfSize = uMaskRect.zw * 0.5;
  vec2 p = fragPx - center;
  vec4 r = vec4(
    max(uMaskRadii[0], uMaskRadii[1]),
    max(uMaskRadii[2], uMaskRadii[3]),
    max(uMaskRadii[4], uMaskRadii[5]),
    max(uMaskRadii[6], uMaskRadii[7])
  );
  return sdRoundedRect(p, halfSize, r);
}

float spillMaskAlpha(vec2 fragPx) {
  if (uMaskEnabled < 0.5) return 1.0;
  float sd = spillMaskSD(fragPx);
  float aa = max(fwidth(sd), 1.0);
  return 1.0 - smoothstep(-aa, aa, sd);
}
`;
