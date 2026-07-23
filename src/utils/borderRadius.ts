/** Parse a CSS radius token like "12px" or "50%" against an axis length. */
function parseRadiusToken(token: string, axisPx: number): number {
  const t = token.trim();
  if (!t || t === '0') return 0;
  if (t.endsWith('%')) {
    const pct = parseFloat(t);
    return Number.isFinite(pct) ? (pct / 100) * axisPx : 0;
  }
  const px = parseFloat(t);
  return Number.isFinite(px) ? px : 0;
}

/**
 * Resolve one corner's computed radius string ("12px" or "12px 8px")
 * into [rx, ry] in CSS pixels.
 */
export function parseCornerRadius(
  value: string,
  widthPx: number,
  heightPx: number,
): [number, number] {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [0, 0];
  if (parts.length === 1) {
    const r = parseRadiusToken(parts[0]!, widthPx);
    // Single value: circle-ish — use min axis for % already handled per token;
    // for px, CSS uses the same length for both axes.
    const rx = parseRadiusToken(parts[0]!, widthPx);
    const ry = parseRadiusToken(parts[0]!, heightPx);
    // For non-% px values, both parses equal the same px; for %, they differ by axis.
    if (parts[0]!.endsWith('%')) return [rx, ry];
    return [r, r];
  }
  return [
    parseRadiusToken(parts[0]!, widthPx),
    parseRadiusToken(parts[1]!, heightPx),
  ];
}

export interface CssBoxRadii {
  width: number;
  height: number;
  radii: [[number, number], [number, number], [number, number], [number, number]];
}

/** Read layout box + resolved border-radius corners from a DOM element. */
export function readCssRoundedRect(el: HTMLElement): CssBoxRadii {
  const width = el.clientWidth;
  const height = el.clientHeight;
  const style = getComputedStyle(el);

  const radii: CssBoxRadii['radii'] = [
    parseCornerRadius(style.borderTopLeftRadius, width, height),
    parseCornerRadius(style.borderTopRightRadius, width, height),
    parseCornerRadius(style.borderBottomRightRadius, width, height),
    parseCornerRadius(style.borderBottomLeftRadius, width, height),
  ];

  // CSS clamps radii so they fit the box (simplified proportional clamp).
  clampRadii(radii, width, height);

  return { width, height, radii };
}

function clampRadii(
  radii: CssBoxRadii['radii'],
  width: number,
  height: number,
): void {
  const sumTop = radii[0][0] + radii[1][0];
  const sumBottom = radii[3][0] + radii[2][0];
  const sumLeft = radii[0][1] + radii[3][1];
  const sumRight = radii[1][1] + radii[2][1];

  const scaleX =
    Math.max(sumTop, sumBottom) > width && width > 0
      ? width / Math.max(sumTop, sumBottom)
      : 1;
  const scaleY =
    Math.max(sumLeft, sumRight) > height && height > 0
      ? height / Math.max(sumLeft, sumRight)
      : 1;
  const scale = Math.min(scaleX, scaleY, 1);

  if (scale < 1) {
    for (const corner of radii) {
      corner[0] *= scale;
      corner[1] *= scale;
    }
  }
}
