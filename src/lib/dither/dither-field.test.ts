import { describe, expect, test } from "vitest";

import {
  densityFromImage,
  dirtyRegionBetween,
  pointerHighlightRegionIn,
  renderDitherField,
  revealProgressAt,
  thresholdAt,
} from "./dither-field.ts";

import type { DitherField, RenderDitherFieldOptions } from "./dither-field.ts";

const COLOR = [10, 20, 30] as const;

const ditherFieldOf = (width: number, height: number, value: number): DitherField => ({
  width,
  height,
  density: new Float32Array(width * height).fill(value),
});
const render = (ditherField: DitherField, options: Partial<RenderDitherFieldOptions> = {}) => {
  const rgba = new Uint8ClampedArray(ditherField.width * ditherField.height * 4);
  renderDitherField(ditherField, { color: COLOR, ...options }, rgba);
  return rgba;
};
const isPixelFilled = (rgba: Uint8ClampedArray, width: number, x: number, y: number) =>
  rgba[(y * width + x) * 4 + 3] === 255;
const filledFraction = (rgba: Uint8ClampedArray) => {
  let filledPixelCount = 0;

  for (let offset = 3; offset < rgba.length; offset += 4) {
    filledPixelCount += rgba[offset] === 255 ? 1 : 0;
  }

  return filledPixelCount / (rgba.length / 4);
};

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

  test("repeats every eight pixels in both directions", () => {
    expect(thresholdAt(3, 5)).toBe(thresholdAt(11, 13));
  });
});

describe("renderDitherField", () => {
  test("fills a fraction of the pixels equal to the density", () => {
    expect(filledFraction(render(ditherFieldOf(16, 16, 0.25)))).toBe(0.25);
    expect(filledFraction(render(ditherFieldOf(16, 16, 0.5)))).toBe(0.5);
  });

  test("paints filled pixels in the given color, and leaves the other pixels transparent", () => {
    const rgba = render(ditherFieldOf(8, 8, 0.5));
    const pixels = Array.from({ length: 64 }, (_, index) => [...rgba.slice(index * 4, index * 4 + 4)]);

    expect(pixels).toContainEqual([...COLOR, 255]);
    expect(pixels).toContainEqual([...COLOR, 0]);
  });

  test("leaves every pixel transparent at a `revealProgress` of `0`, whatever the density", () => {
    expect(filledFraction(render(ditherFieldOf(8, 8, 1), { revealProgress: 0 }))).toBe(0);
  });

  test("clears pixels under a pointer highlight, and leaves the pattern unchanged 36 pixels from its center", () => {
    const pointerHighlight = { x: 4, y: 4, standardDeviation: 2, strength: 1 };
    const rgbaUnderPointerHighlight = render(ditherFieldOf(64, 64, 0.5), { pointerHighlight });
    const rgbaWithoutPointerHighlight = render(ditherFieldOf(64, 64, 0.5));

    expect([
      isPixelFilled(rgbaUnderPointerHighlight, 64, 4, 4),
      isPixelFilled(rgbaUnderPointerHighlight, 64, 5, 4),
      isPixelFilled(rgbaUnderPointerHighlight, 64, 4, 5),
    ]).toEqual([false, false, false]);

    for (let y = 40; y < 48; y += 1) {
      for (let x = 40; x < 48; x += 1) {
        expect(isPixelFilled(rgbaUnderPointerHighlight, 64, x, y)).toBe(
          isPixelFilled(rgbaWithoutPointerHighlight, 64, x, y),
        );
      }
    }
  });

  test("renders the same pattern under a pointer highlight whose `strength` is `0` as without a pointer highlight", () => {
    const pointerHighlight = { x: 4, y: 4, standardDeviation: 2, strength: 0 };
    expect(render(ditherFieldOf(16, 16, 0.5), { pointerHighlight })).toEqual(render(ditherFieldOf(16, 16, 0.5)));
  });

  test("writes only the pixels inside the `region`", () => {
    const rgba = new Uint8ClampedArray(8 * 8 * 4);

    renderDitherField(ditherFieldOf(8, 8, 1), { color: COLOR, region: { x: 2, y: 3, width: 4, height: 2 } }, rgba);

    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const isInsideRegion = x >= 2 && x < 6 && y >= 3 && y < 5;
        expect(isPixelFilled(rgba, 8, x, y)).toBe(isInsideRegion);
      }
    }
  });

  test("renders the pixels inside the `region` the same as a render of the whole dither field", () => {
    const pointerHighlight = { x: 10, y: 6, standardDeviation: 2, strength: 1 };
    const region = { x: 3, y: 1, width: 9, height: 11 };
    const partial = render(ditherFieldOf(16, 16, 0.5), { pointerHighlight, region });
    const whole = render(ditherFieldOf(16, 16, 0.5), { pointerHighlight });

    for (let y = region.y; y < region.y + region.height; y += 1) {
      for (let x = region.x; x < region.x + region.width; x += 1) {
        expect(isPixelFilled(partial, 16, x, y)).toBe(isPixelFilled(whole, 16, x, y));
      }
    }
  });
});

describe("pointerHighlightRegionIn", () => {
  test("returns the square three standard deviations either side of the pointer highlight's center", () => {
    const pointerHighlight = { x: 20, y: 30, standardDeviation: 2, strength: 1 };
    expect(pointerHighlightRegionIn(ditherFieldOf(64, 64, 0), pointerHighlight)).toEqual({
      x: 14,
      y: 24,
      width: 13,
      height: 13,
    });
  });

  test("clips the region to the dither field", () => {
    const pointerHighlight = { x: 1, y: 62, standardDeviation: 2, strength: 1 };
    expect(pointerHighlightRegionIn(ditherFieldOf(64, 64, 0), pointerHighlight)).toEqual({
      x: 0,
      y: 56,
      width: 8,
      height: 8,
    });
  });

  test("returns `null` for a pointer highlight whose `strength` is `0`", () => {
    const pointerHighlight = { x: 20, y: 30, standardDeviation: 2, strength: 0 };
    expect(pointerHighlightRegionIn(ditherFieldOf(64, 64, 0), pointerHighlight)).toBeNull();
  });

  test("returns `null` for a pointer highlight wholly outside the dither field", () => {
    const pointerHighlight = { x: 100, y: 30, standardDeviation: 2, strength: 1 };
    expect(pointerHighlightRegionIn(ditherFieldOf(64, 64, 0), pointerHighlight)).toBeNull();
  });

  test("contains every pixel the pointer highlight changes", () => {
    const ditherField = ditherFieldOf(64, 64, 0.5);
    const pointerHighlight = { x: 20.4, y: 30.7, standardDeviation: 2.5, strength: 1 };
    const region = pointerHighlightRegionIn(ditherField, pointerHighlight);
    const rgbaUnderPointerHighlight = render(ditherField, { pointerHighlight });
    const rgbaWithoutPointerHighlight = render(ditherField);

    expect(region).not.toBeNull();

    for (let y = 0; y < 64; y += 1) {
      for (let x = 0; x < 64; x += 1) {
        if (
          isPixelFilled(rgbaUnderPointerHighlight, 64, x, y) !== isPixelFilled(rgbaWithoutPointerHighlight, 64, x, y)
        ) {
          expect(x).toBeGreaterThanOrEqual(region?.x ?? Infinity);
          expect(x).toBeLessThan((region?.x ?? 0) + (region?.width ?? 0));
          expect(y).toBeGreaterThanOrEqual(region?.y ?? Infinity);
          expect(y).toBeLessThan((region?.y ?? 0) + (region?.height ?? 0));
        }
      }
    }
  });
});

describe("dirtyRegionBetween", () => {
  const ditherField = ditherFieldOf(64, 64, 0);

  test("returns the smallest region containing both pointer highlights' regions", () => {
    const previousPointerHighlight = { x: 10, y: 10, standardDeviation: 1, strength: 1 };
    const pointerHighlight = { x: 20, y: 14, standardDeviation: 1, strength: 1 };

    expect(dirtyRegionBetween(ditherField, previousPointerHighlight, pointerHighlight)).toEqual({
      x: 7,
      y: 7,
      width: 17,
      height: 11,
    });
  });

  test("returns the previous pointer highlight's region when the current one's `strength` is `0`", () => {
    const previousPointerHighlight = { x: 10, y: 10, standardDeviation: 1, strength: 1 };
    const pointerHighlight = { x: 20, y: 14, standardDeviation: 1, strength: 0 };

    expect(dirtyRegionBetween(ditherField, previousPointerHighlight, pointerHighlight)).toEqual(
      pointerHighlightRegionIn(ditherField, previousPointerHighlight),
    );
  });

  test("returns the current pointer highlight's region when the previous one's `strength` is `0`", () => {
    const previousPointerHighlight = { x: 10, y: 10, standardDeviation: 1, strength: 0 };
    const pointerHighlight = { x: 20, y: 14, standardDeviation: 1, strength: 1 };

    expect(dirtyRegionBetween(ditherField, previousPointerHighlight, pointerHighlight)).toEqual(
      pointerHighlightRegionIn(ditherField, pointerHighlight),
    );
  });

  test("returns `null` when neither pointer highlight has a `strength` above `0`", () => {
    const pointerHighlight = { x: 10, y: 10, standardDeviation: 1, strength: 0 };
    expect(dirtyRegionBetween(ditherField, pointerHighlight, pointerHighlight)).toBeNull();
  });
});

describe("densityFromImage", () => {
  test("returns `1` for black and `0` for white", () => {
    const [black, white] = densityFromImage(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]));

    expect(black).toBe(1);
    expect(white).toBeCloseTo(0);
  });

  test("returns `0` for a transparent pixel", () => {
    expect([...densityFromImage(new Uint8ClampedArray([0, 0, 0, 0]))]).toEqual([0]);
  });

  test("moves a density further from `0.5` at a `contrast` above `1`", () => {
    const gray = new Uint8ClampedArray([64, 64, 64, 255]);
    expect(densityFromImage(gray, 2)[0]).toBeGreaterThan(densityFromImage(gray, 1)[0] ?? 0);
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
