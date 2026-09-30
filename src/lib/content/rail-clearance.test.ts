import { describe, expect, test } from "vitest";

import { railClearanceOf } from "./rail-clearance.ts";

describe("railClearanceOf", () => {
  test("returns how far the lowest rail item extends below the top of the element's row", () => {
    expect(railClearanceOf([120, 180, 150], 100)).toBe(80);
  });

  test("rounds a fractional distance up to a whole pixel", () => {
    expect(railClearanceOf([100.2], 100)).toBe(1);
  });

  test("returns `0` when every rail item ends above the top of the element's row", () => {
    expect(railClearanceOf([60, 90], 100)).toBe(0);
  });

  test("returns `0` when `railItemBottoms` is empty", () => {
    expect(railClearanceOf([], 100)).toBe(0);
  });
});
