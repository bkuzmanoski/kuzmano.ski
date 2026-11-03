import { describe, expect, test } from "vitest";

import { BAYER_MATRIX_SIZE, thresholdAt } from "./bayer-matrix.ts";

describe("thresholdAt", () => {
  test("returns a different threshold for each cell of the matrix", () => {
    const thresholds = new Set<number>();

    for (let y = 0; y < BAYER_MATRIX_SIZE; y += 1) {
      for (let x = 0; x < BAYER_MATRIX_SIZE; x += 1) {
        thresholds.add(thresholdAt(x, y));
      }
    }

    expect(thresholds.size).toBe(BAYER_MATRIX_SIZE * BAYER_MATRIX_SIZE);
  });

  test("returns every threshold strictly between `0` and `1`", () => {
    for (let y = 0; y < BAYER_MATRIX_SIZE; y += 1) {
      for (let x = 0; x < BAYER_MATRIX_SIZE; x += 1) {
        expect(thresholdAt(x, y)).toBeGreaterThan(0);
        expect(thresholdAt(x, y)).toBeLessThan(1);
      }
    }
  });

  test("repeats every `BAYER_MATRIX_SIZE` cells in both directions", () => {
    expect(thresholdAt(3, 5)).toBe(thresholdAt(3 + BAYER_MATRIX_SIZE, 5 + BAYER_MATRIX_SIZE));
  });
});
