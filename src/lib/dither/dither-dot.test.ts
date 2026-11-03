import { describe, expect, test } from "vitest";

import { cssPixelsPerDitherDot } from "./dither-dot.ts";

describe("cssPixelsPerDitherDot", () => {
  test("rounds a dither dot to the nearest whole number of device pixels", () => {
    expect(cssPixelsPerDitherDot(1.25)).toBe(1 / 1.25);
    expect(cssPixelsPerDitherDot(1.5)).toBe(2 / 1.5);
  });

  test("returns at least one device pixel when the device pixel ratio is below 1", () => {
    expect(cssPixelsPerDitherDot(0.5)).toBe(2);
  });
});
