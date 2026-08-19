import { describe, expect, test } from "vitest";

import { isBrowserHandledClick } from "./link";

import type { MouseEvent } from "react";

const click = (overrides: Partial<MouseEvent> = {}) =>
  ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...overrides }) as MouseEvent;

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
