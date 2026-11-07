import { beforeEach, describe, expect, test, vi } from "vitest";

import { isApplePlatform } from "../device.ts";

import { keyboardScrollDelta } from "./keyboard-scroll.ts";

import type { ScrollKeyEvent } from "./keyboard-scroll.ts";

vi.mock("../device.ts", () => ({ isApplePlatform: vi.fn() }));

beforeEach(() => vi.mocked(isApplePlatform).mockReturnValue(false));

const ARROW_STEP_PX = 40;
const VIEWPORT = { clientHeight: 300, scrollHeight: 1_000 };
const PAGE_PX = VIEWPORT.clientHeight - ARROW_STEP_PX;

const keyPress = (key: string, modifiers: Partial<ScrollKeyEvent> = {}): ScrollKeyEvent => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("keyboardScrollDelta", () => {
  test.each([
    ["the Up arrow key", keyPress("ArrowUp"), -ARROW_STEP_PX],
    ["the Down arrow key", keyPress("ArrowDown"), ARROW_STEP_PX],
    ["the Page Up key", keyPress("PageUp"), -PAGE_PX],
    ["the Page Down key", keyPress("PageDown"), PAGE_PX],
    ["the Space key", keyPress(" "), PAGE_PX],
    ["the Space key with Shift", keyPress(" ", { shiftKey: true }), -PAGE_PX],
    ["the Home key", keyPress("Home"), -VIEWPORT.scrollHeight],
    ["the End key", keyPress("End"), VIEWPORT.scrollHeight],
  ])("returns the distance %s scrolls", (_label, event, expectedDelta) => {
    expect(keyboardScrollDelta(event, VIEWPORT, ARROW_STEP_PX)).toBe(expectedDelta);
  });

  test("scrolls a page by at least one arrow step in a viewport shorter than two arrow steps", () => {
    expect(keyboardScrollDelta(keyPress("PageDown"), { clientHeight: 50, scrollHeight: 1_000 }, ARROW_STEP_PX)).toBe(
      ARROW_STEP_PX,
    );
  });

  test("returns `null` for a key that does not scroll", () => {
    expect(keyboardScrollDelta(keyPress("a"), VIEWPORT, ARROW_STEP_PX)).toBeNull();
  });

  test.each([
    ["Option", { altKey: true }, PAGE_PX],
    ["Command", { metaKey: true }, VIEWPORT.scrollHeight],
  ])(
    "on an Apple platform, the Down arrow key with %s scrolls like its page or end key",
    (_label, modifiers, delta) => {
      vi.mocked(isApplePlatform).mockReturnValue(true);
      expect(keyboardScrollDelta(keyPress("ArrowDown", modifiers), VIEWPORT, ARROW_STEP_PX)).toBe(delta);
    },
  );

  test.each([
    ["with Option on another platform", { altKey: true }, false],
    ["with Control on an Apple platform", { ctrlKey: true }, true],
    ["with Option and Command on an Apple platform", { altKey: true, metaKey: true }, true],
  ])("returns `null` for the Down arrow key %s", (_label, modifiers, isApple) => {
    vi.mocked(isApplePlatform).mockReturnValue(isApple);
    expect(keyboardScrollDelta(keyPress("ArrowDown", modifiers), VIEWPORT, ARROW_STEP_PX)).toBeNull();
  });
});
