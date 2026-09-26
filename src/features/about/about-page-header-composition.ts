import type { DitherField } from "#/lib/dither/dither-field.ts";
import type { Rect } from "#/lib/geometry.ts";
import { smoothstep } from "#/lib/math.ts";

export type PicturePlacement = Rect;

export const BACKDROP_TOP_DENSITY = 0.5; // The backdrop's density at the top edge of the dither field. It falls to 0 at the bottom edge.

const BACKDROP_FALLOFF_EXPONENT = 1.5; // The exponent of the backdrop's falloff from top to bottom. Above 1, the backdrop thins fastest near the top.

const PICTURE_MAXIMUM_WIDTH_FRACTION = 0.6; // The widest the picture may be, as a fraction of the dither field's width.
const PICTURE_FEATHER_INLINE_FRACTION = 0.3; // How far into the picture its left edge fades into the backdrop, as a fraction of its width.
const PICTURE_FEATHER_BLOCK_FRACTION = 0.12; // How far into the picture its top edge fades into the backdrop, as a fraction of its height.

export function picturePlacementFor(
  pictureAspectRatio: number,
  width: number,
  height: number,
  columnEnd: number,
): PicturePlacement {
  const pictureWidth = Math.min(height * pictureAspectRatio, width * PICTURE_MAXIMUM_WIDTH_FRACTION);
  const pictureHeight = pictureWidth / pictureAspectRatio;

  return {
    x: Math.round(Math.min(width, columnEnd) - pictureWidth),
    y: Math.round(height - pictureHeight),
    width: Math.round(pictureWidth),
    height: Math.round(pictureHeight),
  };
}

export function composeHeaderDitherField(
  width: number,
  height: number,
  picture: { density: Float32Array; placement: PicturePlacement } | null,
): DitherField {
  const density = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const backdropDensity = BACKDROP_TOP_DENSITY * (1 - y / Math.max(1, height - 1)) ** BACKDROP_FALLOFF_EXPONENT;

    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;

      if (!picture) {
        density[index] = backdropDensity;
        continue;
      }

      const { x: left, y: top, width: pictureWidth, height: pictureHeight } = picture.placement;
      const isInsidePicture = x >= left && x < left + pictureWidth && y >= top && y < top + pictureHeight;

      if (!isInsidePicture) {
        density[index] = backdropDensity;
        continue;
      }

      const pictureWeight =
        smoothstep(left, left + pictureWidth * PICTURE_FEATHER_INLINE_FRACTION, x) *
        smoothstep(top, top + pictureHeight * PICTURE_FEATHER_BLOCK_FRACTION, y);
      const pictureDensity = picture.density[(y - top) * pictureWidth + (x - left)] ?? 0;

      density[index] = backdropDensity * (1 - pictureWeight) + pictureDensity * pictureWeight;
    }
  }

  return { width, height, density };
}
