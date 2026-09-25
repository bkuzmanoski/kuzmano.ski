import { describe, expect, test } from "vitest";

import { clamp, cycle, smoothstep } from "./math.ts";

describe("clamp", () => {
  test("returns a value already inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test("returns the nearest end of the range for a value outside it", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(14, 0, 10)).toBe(10);
  });

  test("returns the only value a single-point range allows", () => {
    expect(clamp(5, 2, 2)).toBe(2);
  });

  test("returns the floor when the ceiling is below it", () => {
    expect(clamp(5, 0, -40)).toBe(0);
    expect(clamp(-5, 0, -40)).toBe(0);
  });
});

describe("smoothstep", () => {
  test("returns `0` below the interval and `1` above it", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  test("returns `0.5` at the midpoint", () => {
    expect(smoothstep(0, 10, 5)).toBe(0.5);
  });
});

describe("cycle", () => {
  test("steps in either direction", () => {
    expect(cycle(4, 1, 1)).toBe(2);
    expect(cycle(4, 1, -1)).toBe(0);
  });

  test("wraps at both ends", () => {
    expect(cycle(4, 3, 1)).toBe(0);
    expect(cycle(4, 0, -1)).toBe(3);
  });

  test("steps from an index of -1 to the first or the last entry", () => {
    expect(cycle(4, -1, 1)).toBe(0);
    expect(cycle(4, -1, -1)).toBe(3);
  });

  test("steps from an index of -1 to the only entry of a single-entry list", () => {
    expect(cycle(1, -1, 1)).toBe(0);
    expect(cycle(1, -1, -1)).toBe(0);
  });

  test("returns 0 for an empty list", () => {
    expect(cycle(0, 0, 1)).toBe(0);
  });
});
