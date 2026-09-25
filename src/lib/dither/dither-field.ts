import { clamp } from "../math.ts";

import type { Rgb } from "../color.ts";
import type { Rect } from "../geometry.ts";

const BAYER_MATRIX_8X8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54,
  22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29,
  53, 21,
] as const; // In row-major order.
const BAYER_MATRIX_SIZE = 8;
const BAYER_LEVEL_COUNT = BAYER_MATRIX_SIZE * BAYER_MATRIX_SIZE;
const POINTER_HIGHLIGHT_REACH_STANDARD_DEVIATIONS = 3;

export interface DitherField {
  width: number;
  height: number;
  density: Float32Array; // Density per pixel, row-major, 0 to 1.
}

export interface PointerHighlight {
  x: number;
  y: number;
  standardDeviation: number;
  strength: number;
}

export const thresholdAt = (x: number, y: number): number =>
  ((BAYER_MATRIX_8X8[(y % BAYER_MATRIX_SIZE) * BAYER_MATRIX_SIZE + (x % BAYER_MATRIX_SIZE)] ?? 0) + 0.5) /
  BAYER_LEVEL_COUNT;

export function densityFromImage(rgba: Uint8ClampedArray, contrast = 1): Float32Array {
  const density = new Float32Array(rgba.length / 4);

  for (let index = 0; index < density.length; index += 1) {
    const offset = index * 4;
    const luminance =
      (0.2126 * (rgba[offset] ?? 0) + 0.7152 * (rgba[offset + 1] ?? 0) + 0.0722 * (rgba[offset + 2] ?? 0)) / 255;
    const alpha = (rgba[offset + 3] ?? 255) / 255;

    density[index] = clamp(((1 - luminance) * alpha - 0.5) * contrast + 0.5, 0, 1);
  }

  return density;
}

export function pointerHighlightRegionIn(ditherField: DitherField, pointerHighlight: PointerHighlight): Rect | null {
  if (pointerHighlight.strength <= 0) {
    return null;
  }

  const reach = POINTER_HIGHLIGHT_REACH_STANDARD_DEVIATIONS * pointerHighlight.standardDeviation;
  const left = Math.max(0, Math.floor(pointerHighlight.x - reach));
  const top = Math.max(0, Math.floor(pointerHighlight.y - reach));
  const right = Math.min(ditherField.width, Math.ceil(pointerHighlight.x + reach) + 1);
  const bottom = Math.min(ditherField.height, Math.ceil(pointerHighlight.y + reach) + 1);

  if (right <= left || bottom <= top) {
    return null;
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function dirtyRegionBetween(
  ditherField: DitherField,
  previousPointerHighlight: PointerHighlight,
  pointerHighlight: PointerHighlight,
): Rect | null {
  const previousRegion = pointerHighlightRegionIn(ditherField, previousPointerHighlight);
  const currentRegion = pointerHighlightRegionIn(ditherField, pointerHighlight);

  if (!previousRegion || !currentRegion) {
    return previousRegion ?? currentRegion;
  }

  const left = Math.min(previousRegion.x, currentRegion.x);
  const top = Math.min(previousRegion.y, currentRegion.y);
  const right = Math.max(previousRegion.x + previousRegion.width, currentRegion.x + currentRegion.width);
  const bottom = Math.max(previousRegion.y + previousRegion.height, currentRegion.y + currentRegion.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function revealProgressAt(elapsedMs: number, durationMs: number, stepCount: number): number {
  const step = Math.floor((elapsedMs / durationMs) * stepCount);
  return clamp(step / stepCount, 0, 1);
}

export interface RenderDitherFieldOptions {
  color: Rgb;
  revealProgress?: number; // From 0, at which every pixel is transparent, to 1. The densest pixels are revealed first.
  pointerHighlight?: PointerHighlight | null;
  region?: Rect;
}

export function renderDitherField(
  { width, height, density }: DitherField,
  {
    color,
    revealProgress = 1,
    pointerHighlight = null,
    region = { x: 0, y: 0, width, height },
  }: RenderDitherFieldOptions,
  rgba: Uint8ClampedArray,
): void {
  const [red, green, blue] = color;
  const activePointerHighlight = pointerHighlight && pointerHighlight.strength > 0 ? pointerHighlight : null;
  const reach = activePointerHighlight
    ? POINTER_HIGHLIGHT_REACH_STANDARD_DEVIATIONS * activePointerHighlight.standardDeviation
    : 0;
  const twoVariance = activePointerHighlight ? 2 * activePointerHighlight.standardDeviation ** 2 : 1;
  const regionRight = Math.min(width, region.x + region.width);
  const regionBottom = Math.min(height, region.y + region.height);

  for (let y = Math.max(0, region.y); y < regionBottom; y += 1) {
    const dy = activePointerHighlight ? y - activePointerHighlight.y : 0;
    const isRowHighlighted = activePointerHighlight !== null && Math.abs(dy) < reach;

    for (let x = Math.max(0, region.x); x < regionRight; x += 1) {
      const index = y * width + x;
      let value = (density[index] ?? 0) - (1 - revealProgress);

      if (isRowHighlighted) {
        const dx = x - activePointerHighlight.x;

        if (Math.abs(dx) < reach) {
          value -= activePointerHighlight.strength * Math.exp(-(dx * dx + dy * dy) / twoVariance);
        }
      }

      const offset = index * 4;
      const isFilled = value > thresholdAt(x, y);

      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = isFilled ? 255 : 0;
    }
  }
}
