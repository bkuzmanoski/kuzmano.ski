import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { FADE_IN_DURATION_MS, sleep, wake } from "#/lib/screensaver/lifecycle.ts";

import { Screensaver } from "./screensaver.tsx";

const MOUSE_MOVE = { buttons: 0 };
const TOUCH_MOVE = { buttons: 1 };

beforeEach(() => vi.useFakeTimers());

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

test("a finger dragging across it does not dismiss the screensaver, so the tap's final click is caught by it", () => {
  const screensaver = raise();

  fireEvent.pointerMove(screensaver, TOUCH_MOVE);

  expect(screensaver.childElementCount).toBeGreaterThan(0);
});

test("input that trails the gesture it was raised with does not dismiss the screensaver", () => {
  const { container } = render(<Screensaver />);
  const screensaver = container.firstElementChild!;

  act(sleep);
  fireEvent.pointerMove(screensaver, MOUSE_MOVE);
  fireEvent.click(screensaver);
  fireEvent.keyDown(document, { key: "a" });
  fadeIn();

  expect(screensaver.childElementCount).toBeGreaterThan(0);
});
