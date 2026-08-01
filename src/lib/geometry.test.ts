import { describe, expect, test } from "vitest";

import { constrain } from "./geometry";

import type { Rect, Size } from "./geometry";

const containerSize: Size = { width: 1000, height: 800 };
const rect: Rect = { x: 100, y: 50, width: 400, height: 300 };

describe("constrain", () => {
  test("returns a rect unchanged when it already fits", () => {
    expect(constrain(rect, containerSize)).toEqual(rect);
  });

  test("clamps size to the container", () => {
    expect(constrain({ x: 0, y: 0, width: 1400, height: 1200 }, containerSize)).toEqual({
      x: 0,
      y: 0,
      ...containerSize,
    });
  });

  test("clamps position to keep the rect in bounds, without changing size", () => {
    expect(constrain({ ...rect, x: 900, y: 700 }, containerSize)).toEqual({ x: 600, y: 500, width: 400, height: 300 });
  });

  test("clamps a negative position to zero", () => {
    expect(constrain({ ...rect, x: -50, y: -20 }, containerSize)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  test("recomputes constraints as the container is resized", () => {
    const smallContainer: Size = { width: 300, height: 200 };

    expect(constrain(rect, smallContainer)).toEqual({ x: 0, y: 0, ...smallContainer });
    expect(constrain(rect, containerSize)).toEqual(rect);
  });

  test("returns the rect unchanged when the container is unmeasured", () => {
    expect(constrain(rect, { width: 0, height: 0 })).toEqual(rect);
  });
});
