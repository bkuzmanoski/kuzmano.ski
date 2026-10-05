import { describe, expect, test, vi } from "vitest";

import { activateOnKeyPress, isBrowserShortcut } from "./keys.ts";

import type { KeyboardEvent } from "react";

const keyEvent = (init: Partial<KeyboardEvent>) => {
  const preventDefault = vi.fn();
  const event = {
    preventDefault,
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  } as unknown as KeyboardEvent;

  return { event, preventDefault };
};

describe("isBrowserShortcut", () => {
  test.each([
    ["a key pressed with ⌘ held", { key: "r", metaKey: true, ctrlKey: false }],
    ["a key pressed with Control held", { key: "r", metaKey: false, ctrlKey: true }],
    ["`F5`", { key: "F5", metaKey: false, ctrlKey: false }],
    ["`F12`", { key: "F12", metaKey: false, ctrlKey: false }],
  ])("returns `true` for %s", (_, event) => {
    expect(isBrowserShortcut(event)).toBe(true);
  });

  test.each([
    ["a letter", { key: "r", metaKey: false, ctrlKey: false }],
    ["`F` itself", { key: "F", metaKey: false, ctrlKey: false }],
    ["`Space`", { key: " ", metaKey: false, ctrlKey: false }],
  ])("returns `false` for %s", (_, event) => {
    expect(isBrowserShortcut(event)).toBe(false);
  });
});

describe("activateOnKeyPress", () => {
  test("activates the control and prevents the default behavior when Enter or Space is pressed", () => {
    for (const key of ["Enter", " "]) {
      const { event, preventDefault } = keyEvent({ key });
      const activate = vi.fn();

      expect(activateOnKeyPress(event, activate)).toBe(true);
      expect(activate).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalled();
    }
  });

  test("prevents the default behavior of a repeated Enter or Space key press without activating the control again", () => {
    const { event, preventDefault } = keyEvent({ key: "Enter", repeat: true });
    const activate = vi.fn();

    expect(activateOnKeyPress(event, activate)).toBe(true);
    expect(activate).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
  });

  test("does not handle other keys or activation keys pressed with modifiers", () => {
    for (const init of [{ key: "a" }, { key: "Enter", metaKey: true }, { key: " ", shiftKey: true }]) {
      const { event, preventDefault } = keyEvent(init);
      const activate = vi.fn();

      expect(activateOnKeyPress(event, activate)).toBe(false);
      expect(activate).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });
});
