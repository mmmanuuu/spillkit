import type { Mask, MaskSyncContext, MaskUniforms } from '../types';
import { readCssRoundedRect } from '../utils/borderRadius';

/**
 * Mask driven by a DOM element's layout box + computed border-radius.
 * Circle = square element with border-radius: 50%.
 */
export function cssRoundedRect(): Mask {
  return {
    sync(ctx: MaskSyncContext): MaskUniforms {
      const { target, bufferScaleX, bufferScaleY, width, height } = ctx;
      const box = readCssRoundedRect(target);

      // Map CSS px → drawing-buffer px. Assume canvas CSS size matches the
      // painted area; mask covers the full canvas in gl_FragCoord space.
      const bw = width * bufferScaleX;
      const bh = height * bufferScaleY;

      const scaleCorner = (c: [number, number]): [number, number] => [
        c[0] * bufferScaleX,
        c[1] * bufferScaleY,
      ];

      const tl = scaleCorner(box.radii[0]);
      const tr = scaleCorner(box.radii[1]);
      const br = scaleCorner(box.radii[2]);
      const bl = scaleCorner(box.radii[3]);

      // If the target box differs from the canvas CSS size, scale radii/rect
      // by the canvas/target ratio so a full-bleed canvas still matches.
      const sx = box.width > 0 ? width / box.width : 1;
      const sy = box.height > 0 ? height / box.height : 1;

      return {
        uMaskRect: [0, 0, bw, bh],
        uMaskRadii: [
          tl[0] * sx,
          tl[1] * sy,
          tr[0] * sx,
          tr[1] * sy,
          br[0] * sx,
          br[1] * sy,
          bl[0] * sx,
          bl[1] * sy,
        ],
        uMaskEnabled: 1,
      };
    },
  };
}

export const masks = {
  cssRoundedRect,
};
