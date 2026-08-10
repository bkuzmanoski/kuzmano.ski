import { describe, expect, test } from "vitest";

import { clamp, cycle } from "./math";

describe("clamp", () => {
  test("returns a value already inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test("holds a value at each end of the range", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(14, 0, 10)).toBe(10);
  });

  test("returns the only value a single-point range allows", () => {
    expect(clamp(5, 2, 2)).toBe(2);
  });

  test("settles on the floor when the ceiling falls below it", () => {
    expect(clamp(5, 0, -40)).toBe(0);
    expect(clamp(-5, 0, -40)).toBe(0);
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

  test("an index of -1 steps to the first or the last entry", () => {
    expect(cycle(4, -1, 1)).toBe(0);
    expect(cycle(4, -1, -1)).toBe(3);
  });

  test("a step from -1 reaches the only entry of a single-entry list", () => {
    expect(cycle(1, -1, 1)).toBe(0);
    expect(cycle(1, -1, -1)).toBe(0);
  });

  test("an empty list has nowhere to step", () => {
    expect(cycle(0, 0, 1)).toBe(0);
  });
});
