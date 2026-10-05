import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { playClickSound, playKeyDownSound, playKeyUpSound } from "#/lib/audio/sounds.ts";
import { FADE_IN_DURATION_MS, sleep, wake } from "#/lib/screensaver/lifecycle.ts";

import { Screensaver } from "./screensaver.tsx";

const MOUSE_MOVE = { buttons: 0 };
const TOUCH_MOVE = { buttons: 1 };

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal),
);

beforeEach(() => {
  vi.mocked(playClickSound).mockClear();
  vi.mocked(playKeyDownSound).mockClear();
  vi.mocked(playKeyUpSound).mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  act(wake);
  vi.useRealTimers();
});

const fadeIn = () =>
  act(() => {
    vi.advanceTimersByTime(FADE_IN_DURATION_MS);
  });

function raise() {
  const { container } = render(<Screensaver />);

  act(sleep);
  fadeIn();

  return container.firstElementChild!;
}

function renderControlUnderneath() {
  const onKeyDown = vi.fn();
  const onKeyUp = vi.fn();
  const { getByRole } = render(<button type="button" onKeyDown={onKeyDown} onKeyUp={onKeyUp} />);
  const control = getByRole("button");

  control.focus();

  return { control, onKeyDown, onKeyUp };
}

test("the flock is only in the DOM while the screensaver is up, and is removed when it is dismissed", () => {
  const screensaver = raise();

  expect(screensaver.childElementCount).toBeGreaterThan(0);

  act(wake);

  expect(screensaver.childElementCount).toBe(0);
});

test.each([
  ["a click", (target: Element) => fireEvent.click(target)],
  ["a mouse move", (target: Element) => fireEvent.pointerMove(target, MOUSE_MOVE)],
  ["a keypress", () => fireEvent.keyDown(document, { key: "a" })],
])("%s dismisses the screensaver", (_, dismiss) => {
  const screensaver = raise();

  dismiss(screensaver);

  expect(screensaver.childElementCount).toBe(0);
});

test("a pointer move with a button pressed does not dismiss the screensaver", () => {
  const screensaver = raise();

  fireEvent.pointerMove(screensaver, TOUCH_MOVE);

  // The screensaver stays up for the rest of a tap, so the tap's final `click` is
  // dispatched to it rather than to what is under it.
  expect(screensaver.childElementCount).toBeGreaterThan(0);
});

test("input before the fade-in duration has elapsed does not dismiss the screensaver", () => {
  const { container } = render(<Screensaver />);
  const screensaver = container.firstElementChild!;

  act(sleep);
  fireEvent.pointerMove(screensaver, MOUSE_MOVE);
  fireEvent.click(screensaver);
  fireEvent.keyDown(document, { key: "a" });
  fadeIn();

  expect(screensaver.childElementCount).toBeGreaterThan(0);
});

test("pressing the mouse button on the screensaver plays the click sound", () => {
  const screensaver = raise();

  fireEvent.pointerDown(screensaver, { pointerType: "mouse" });

  expect(playClickSound).toHaveBeenCalledOnce();
});

test("pressing a key that dismisses the screensaver plays the key down sound, and releasing it plays the key up sound once", () => {
  raise();

  fireEvent.keyDown(document, { key: "a", code: "KeyA" });

  expect(playKeyDownSound).toHaveBeenCalledOnce();
  expect(playKeyUpSound).not.toHaveBeenCalled();

  fireEvent.keyUp(document, { key: "a", code: "KeyA" });
  fireEvent.keyUp(document, { key: "a", code: "KeyA" });

  expect(playKeyUpSound).toHaveBeenCalledOnce();
});

test("a repeated key down event dismisses the screensaver without playing a key sound", () => {
  const screensaver = raise();

  fireEvent.keyDown(document, { key: "a", code: "KeyA", repeat: true });
  fireEvent.keyUp(document, { key: "a", code: "KeyA" });

  expect(screensaver.childElementCount).toBe(0);
  expect(playKeyDownSound).not.toHaveBeenCalled();
  expect(playKeyUpSound).not.toHaveBeenCalled();
});

test("the key press that dismisses the screensaver is withheld from the focused control underneath, and its default action is prevented", () => {
  const { control, onKeyDown, onKeyUp } = renderControlUnderneath();

  raise();

  expect(fireEvent.keyDown(control, { key: " ", code: "Space" })).toBe(false);
  expect(fireEvent.keyUp(control, { key: " ", code: "Space" })).toBe(false);
  expect(onKeyDown).not.toHaveBeenCalled();
  expect(onKeyUp).not.toHaveBeenCalled();
});

test("a key press while the screensaver fades in is withheld from the focused control underneath, and its default action is prevented", () => {
  const { control, onKeyDown } = renderControlUnderneath();

  render(<Screensaver />);
  act(sleep);

  const isDefaultAllowed = fireEvent.keyDown(control, { key: "a", code: "KeyA" });

  fadeIn();

  expect(isDefaultAllowed).toBe(false);
  expect(onKeyDown).not.toHaveBeenCalled();
});

test("a browser shortcut that dismisses the screensaver is withheld from the focused control underneath, but its default action is not prevented", () => {
  const { control, onKeyDown } = renderControlUnderneath();

  raise();

  expect(fireEvent.keyDown(control, { key: "r", code: "KeyR", metaKey: true })).toBe(true);
  expect(onKeyDown).not.toHaveBeenCalled();
});

test("a function key that dismisses the screensaver is withheld from the focused control underneath, but its default action is not prevented", () => {
  const { control, onKeyDown } = renderControlUnderneath();

  raise();

  expect(fireEvent.keyDown(control, { key: "F5", code: "F5" })).toBe(true);
  expect(onKeyDown).not.toHaveBeenCalled();
});

test("the next press and release of a key whose release was missed reach the focused control underneath, without the key up sound", () => {
  const { control, onKeyDown, onKeyUp } = renderControlUnderneath();

  raise();
  act(() => {
    fireEvent.keyDown(control, { key: "k", code: "KeyK", metaKey: true }); // macOS does not send a key up event for K while ⌘ is held.
  });
  fireEvent.keyDown(control, { key: "k", code: "KeyK" });
  fireEvent.keyUp(control, { key: "k", code: "KeyK" });

  expect(onKeyDown).toHaveBeenCalledOnce();
  expect(onKeyUp).toHaveBeenCalledOnce();
  expect(playKeyUpSound).not.toHaveBeenCalled();
});

test("a key press after the screensaver is dismissed reaches the focused control underneath", () => {
  const { control, onKeyDown } = renderControlUnderneath();

  raise();
  act(() => {
    fireEvent.keyDown(control, { key: "a", code: "KeyA" });
  });
  fireEvent.keyUp(control, { key: "a", code: "KeyA" });
  fireEvent.keyDown(control, { key: "b", code: "KeyB" });

  expect(onKeyDown).toHaveBeenCalledOnce();
});
