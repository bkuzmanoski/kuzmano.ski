import { describe, expect, test } from "vitest";

import { renderDitherField, revealProgressAt } from "./dither-field.ts";

import type { DitherField } from "./dither-field.ts";

const COLOR = [10, 20, 30] as const;

const ditherFieldOf = (width: number, height: number, value: number): DitherField => ({
  width,
  height,
  density: new Float32Array(width * height).fill(value),
  maxDensity: value,
});
const render = (ditherField: DitherField, revealProgress = 1) => {
  const rgba = new Uint8ClampedArray(ditherField.width * ditherField.height * 4);
  renderDitherField(ditherField, { color: COLOR, revealProgress }, rgba);
  return rgba;
};
const filledFraction = (rgba: Uint8ClampedArray) => {
  let filledPixelCount = 0;

  for (let offset = 3; offset < rgba.length; offset += 4) {
    filledPixelCount += rgba[offset] === 255 ? 1 : 0;
  }

  return filledPixelCount / (rgba.length / 4);
};

describe("renderDitherField", () => {
  test("fills a fraction of the pixels equal to the density", () => {
    expect(filledFraction(render(ditherFieldOf(16, 16, 0.25)))).toBe(0.25);
    expect(filledFraction(render(ditherFieldOf(16, 16, 0.5)))).toBe(0.5);
  });

  test("renders filled pixels in the given color, and leaves the other pixels transparent", () => {
    const rgba = render(ditherFieldOf(8, 8, 0.5));
    const pixels = Array.from({ length: 64 }, (_, index) => [...rgba.slice(index * 4, index * 4 + 4)]);

    expect(pixels).toContainEqual([...COLOR, 255]);
    expect(pixels).toContainEqual([...COLOR, 0]);
  });

  test("leaves every pixel transparent at a `revealProgress` of `0`, whatever the density", () => {
    expect(filledFraction(render(ditherFieldOf(8, 8, 1), 0))).toBe(0);
  });

  test("fills the denser pixels before the sparser ones at an intermediate `revealProgress`", () => {
    const ditherField = { ...ditherFieldOf(16, 1, 0.25), maxDensity: 1 };

    ditherField.density.fill(1, 0, 8);

    const rgba = render(ditherField, 0.5);
    const isFilledAt = (x: number) => rgba[x * 4 + 3] === 255;

    expect([0, 1, 2, 3, 4, 5, 6, 7].some(isFilledAt)).toBe(true);
    expect([8, 9, 10, 11, 12, 13, 14, 15].some(isFilledAt)).toBe(false);
  });

  test("fills pixels halfway through the reveal of a field with a maximum density below `1`", () => {
    expect(filledFraction(render(ditherFieldOf(16, 16, 0.5), 0.5))).toBe(0.25);
  });
});

describe("revealProgressAt", () => {
  test("returns `0` when the reveal starts", () => {
    expect(revealProgressAt(0, 1_000, 10)).toBe(0);
  });

  test("returns each step's progress until the next step begins", () => {
    expect(revealProgressAt(100, 1_000, 10)).toBeCloseTo(0.1);
    expect(revealProgressAt(199, 1_000, 10)).toBeCloseTo(0.1);
    expect(revealProgressAt(200, 1_000, 10)).toBeCloseTo(0.2);
  });

  test("returns `1` at the end of the duration and after it", () => {
    expect(revealProgressAt(1_000, 1_000, 10)).toBe(1);
    expect(revealProgressAt(5_000, 1_000, 10)).toBe(1);
  });
});
