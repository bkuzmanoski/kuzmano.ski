import { describe, expect, test } from "vitest";

import { edgeIndexOf, navigationTargetOf } from "./list-navigation.ts";

const COUNT = 5;
const WRAPPING = { wraps: true };
const CLAMPED = { wraps: false };
/** Index 0 and index 4 (the ends) and index 2 are disabled. */
const isEnabledBetweenDisabledEnds = (index: number) => index === 1 || index === 3;

describe("navigationTargetOf", () => {
  test("returns `null` for a key the list does not navigate by", () => {
    expect(navigationTargetOf("ArrowLeft", 2, COUNT, WRAPPING)).toBeNull();
  });

  test.each([
    ["Down", "ArrowDown", 3],
    ["Up", "ArrowUp", 1],
  ])("the %s arrow key steps to the adjacent item", (_label, key, expectedIndex) => {
    expect(navigationTargetOf(key, 2, COUNT, CLAMPED)).toBe(expectedIndex);
  });

  test.each([
    ["Down", "ArrowDown", 4],
    ["Up", "ArrowUp", 0],
  ])(
    "the %s arrow key at the end it points to returns the same index in a list that does not wrap",
    (_label, key, index) => {
      expect(navigationTargetOf(key, index, COUNT, CLAMPED)).toBe(index);
    },
  );

  test.each([
    ["Down", "ArrowDown", 4, 0],
    ["Up", "ArrowUp", 0, 4],
  ])(
    "the %s arrow key at the end it points to continues from the other end in a list that wraps",
    (_label, key, index, expectedIndex) => {
      expect(navigationTargetOf(key, index, COUNT, WRAPPING)).toBe(expectedIndex);
    },
  );

  test.each([
    ["Down", "ArrowDown", 0],
    ["Up", "ArrowUp", 4],
  ])(
    "the %s arrow key without a focused item returns the item at the end it points away from",
    (_label, key, expectedIndex) => {
      expect(navigationTargetOf(key, -1, COUNT, CLAMPED)).toBe(expectedIndex);
      expect(navigationTargetOf(key, -1, COUNT, WRAPPING)).toBe(expectedIndex);
    },
  );

  test.each([
    ["Home", 0],
    ["End", 4],
  ])("the %s key returns the item at that end", (key, expectedIndex) => {
    expect(navigationTargetOf(key, 2, COUNT, CLAMPED)).toBe(expectedIndex);
  });

  test("an arrow key skips a disabled item", () => {
    expect(navigationTargetOf("ArrowDown", 1, COUNT, { ...CLAMPED, isEnabled: isEnabledBetweenDisabledEnds })).toBe(3);
    expect(navigationTargetOf("ArrowUp", 3, COUNT, { ...CLAMPED, isEnabled: isEnabledBetweenDisabledEnds })).toBe(1);
  });

  test("an arrow key wraps past disabled items at the ends in a list that wraps", () => {
    expect(navigationTargetOf("ArrowDown", 3, COUNT, { ...WRAPPING, isEnabled: isEnabledBetweenDisabledEnds })).toBe(1);
  });

  test("an arrow key returns the same index when only disabled items lie in its direction in a list that does not wrap", () => {
    expect(navigationTargetOf("ArrowDown", 3, COUNT, { ...CLAMPED, isEnabled: isEnabledBetweenDisabledEnds })).toBe(3);
  });

  test("an arrow key returns the same index when no other item is enabled", () => {
    expect(navigationTargetOf("ArrowDown", 1, COUNT, { ...WRAPPING, isEnabled: (index) => index === 1 })).toBe(1);
  });

  test("the Home and End keys skip disabled items at the ends", () => {
    expect(navigationTargetOf("Home", 3, COUNT, { ...CLAMPED, isEnabled: isEnabledBetweenDisabledEnds })).toBe(1);
    expect(navigationTargetOf("End", 1, COUNT, { ...CLAMPED, isEnabled: isEnabledBetweenDisabledEnds })).toBe(3);
  });

  test("returns `-1` for an arrow key without a focused item when no item is enabled", () => {
    expect(navigationTargetOf("ArrowDown", -1, COUNT, { ...WRAPPING, isEnabled: () => false })).toBe(-1);
  });

  test("returns `-1` for every key it navigates by in an empty list without a focused item", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
      expect(navigationTargetOf(key, -1, 0, CLAMPED)).toBe(-1);
    }
  });
});

describe("edgeIndexOf", () => {
  test("returns `-1` when no item is enabled", () => {
    expect(edgeIndexOf("first", COUNT, () => false)).toBe(-1);
  });
});
