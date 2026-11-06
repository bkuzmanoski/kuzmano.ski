import { clamp } from "../math.ts";

import type { Rgb } from "../computed-color.ts";

export interface DitherField {
  width: number;
  height: number;
  density: Float32Array;
  maxDensity: number;
}

const BAYER_MATRIX_SIZE = 8;
const BAYER_MATRIX = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54,
  22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29,
  53, 21,
] as const; // In row-major order.

const thresholdAt = (x: number, y: number): number =>
  ((BAYER_MATRIX[(y % BAYER_MATRIX_SIZE) * BAYER_MATRIX_SIZE + (x % BAYER_MATRIX_SIZE)] ?? 0) + 0.5) /
  BAYER_MATRIX.length;

export function revealProgressAt(elapsedMs: number, durationMs: number, stepCount: number): number {
  const step = Math.floor((elapsedMs / durationMs) * stepCount);
  return clamp(step / stepCount, 0, 1);
}

export function renderDitherField(
  { width, height, density, maxDensity }: DitherField,
  { color: [red, green, blue], revealProgress }: { color: Rgb; revealProgress: number },
  rgba: Uint8ClampedArray,
): void {
  const unrevealedDensity = maxDensity * (1 - revealProgress);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const isFilled = (density[index] ?? 0) - unrevealedDensity > thresholdAt(x, y);

      rgba[offset] = red;
      rgba[offset + 1] = green;
      rgba[offset + 2] = blue;
      rgba[offset + 3] = isFilled ? 255 : 0;
    }
  }
}
