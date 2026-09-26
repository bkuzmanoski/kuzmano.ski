import { describe, expect, test } from "vitest";

import {
  BACKDROP_TOP_DENSITY,
  composeHeaderDitherField,
  picturePlacementFor,
} from "./about-page-header-composition.ts";

describe("picturePlacementFor", () => {
  test("places a picture as tall as the dither field against the column end and the bottom edge", () => {
    expect(picturePlacementFor(0.5, 200, 100, 150)).toEqual({ x: 100, y: 0, width: 50, height: 100 });
  });

  test("limits a wide picture to 60% of the dither field's width", () => {
    expect(picturePlacementFor(2, 100, 100, 100)).toEqual({ x: 40, y: 70, width: 60, height: 30 });
  });

  test("places the picture against the right edge when the column end is beyond it", () => {
    expect(picturePlacementFor(1, 100, 50, 500)).toEqual({ x: 50, y: 0, width: 50, height: 50 });
  });
});

describe("composeHeaderDitherField", () => {
  test("returns a density that falls from the top edge to `0` at the bottom edge without a picture", () => {
    const { density } = composeHeaderDitherField(4, 10, null);

    expect(density[0]).toBeCloseTo(BACKDROP_TOP_DENSITY);
    expect(density[9 * 4]).toBe(0);
    expect(density[2 * 4]).toBeGreaterThan(density[6 * 4] ?? 1);
  });

  test("uses the picture's density unchanged away from its feathered edges", () => {
    const width = 20;
    const height = 20;
    const pictureDensity = new Float32Array(10 * height);

    pictureDensity[19 * 10 + 9] = 1;

    const { density } = composeHeaderDitherField(width, height, {
      density: pictureDensity,
      placement: { x: 10, y: 0, width: 10, height },
    });

    expect(density[19 * width + 19]).toBe(1);
  });

  test("leaves the backdrop density unchanged outside the picture", () => {
    const width = 20;
    const height = 20;
    const backdropDensity = composeHeaderDitherField(width, height, null).density;
    const { density } = composeHeaderDitherField(width, height, {
      density: new Float32Array(10 * height).fill(1),
      placement: { x: 10, y: 0, width: 10, height },
    });

    expect(density[5 * width + 2]).toBe(backdropDensity[5 * width + 2]);
  });
});
