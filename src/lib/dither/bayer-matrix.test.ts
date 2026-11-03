import { describe, expect, test } from "vitest";

import { thresholdAt } from "./bayer-matrix.ts";

describe("thresholdAt", () => {
  test("returns a different threshold for each cell of the 8x8 matrix", () => {
    const thresholds = new Set<number>();

    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        thresholds.add(thresholdAt(x, y));
      }
    }

    expect(thresholds.size).toBe(64);
  });

  test("returns every threshold strictly between `0` and `1`", () => {
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        expect(thresholdAt(x, y)).toBeGreaterThan(0);
        expect(thresholdAt(x, y)).toBeLessThan(1);
      }
    }
  });

  test("repeats every eight cells in both directions", () => {
    expect(thresholdAt(3, 5)).toBe(thresholdAt(11, 13));
  });
});
