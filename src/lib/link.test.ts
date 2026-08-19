import { describe, expect, test } from "vitest";

import { isBrowserHandledClick, isRepeatClick } from "./link";

import type { MouseEvent } from "react";

const click = (overrides: Partial<MouseEvent> = {}) =>
  ({
    button: 0,
    detail: 1,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  }) as MouseEvent;

describe("isRepeatClick", () => {
  test("returns false for the first press of a sequence", () => {
    expect(isRepeatClick(click({ detail: 1 }))).toBe(false);
  });

  test("returns true for every press after the first", () => {
    expect(isRepeatClick(click({ detail: 2 }))).toBe(true);
    expect(isRepeatClick(click({ detail: 3 }))).toBe(true);
  });
});

describe("isBrowserHandledClick", () => {
  test("returns false for an unmodified primary press", () => {
    expect(isBrowserHandledClick(click())).toBe(false);
  });

  test("returns true for a modified press", () => {
    expect(isBrowserHandledClick(click({ metaKey: true }))).toBe(true);
    expect(isBrowserHandledClick(click({ ctrlKey: true }))).toBe(true);
    expect(isBrowserHandledClick(click({ shiftKey: true }))).toBe(true);
    expect(isBrowserHandledClick(click({ altKey: true }))).toBe(true);
  });

  test("returns true for a non-primary button press", () => {
    expect(isBrowserHandledClick(click({ button: 1 }))).toBe(true);
  });
});
