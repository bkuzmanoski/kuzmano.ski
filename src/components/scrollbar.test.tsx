import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { clamp } from "#/lib/math";

import { ScrollPane } from "./scroll-pane";
import { ARROW_STEP_PX, ARROW_STEP_REPEAT_DELAY_MS, ARROW_STEP_REPEAT_INTERVAL_MS } from "./scrollbar";

const playClick = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playClick }),
);

const MAX_SCROLL_TOP = 900; // The 1000px of content less the 100px viewport below.

beforeEach(() => {
  vi.useFakeTimers();
  playClick.mockClear();
});

afterEach(() => vi.useRealTimers());

/** A pane whose content overflows, so the scrollbar renders its arrows. */
function renderPane() {
  render(
    <ScrollPane id="pane">
      <p>Content</p>
    </ScrollPane>,
  );

  const viewport = document.getElementById("pane")!;

  Object.defineProperty(viewport, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(viewport, "clientHeight", { value: 100, configurable: true });
  // Only the options form is used; `scrollTop` is clamped as the browser clamps it.
  viewport.scrollBy = ((options: ScrollToOptions = {}) => {
    viewport.scrollTop = clamp(viewport.scrollTop + (options.top ?? 0), 0, MAX_SCROLL_TOP);
  }) as typeof viewport.scrollBy;

  fireEvent.scroll(viewport); // Report the metrics, so the scrollbar sees the overflow.

  return { viewport, down: screen.getByRole("button", { name: "Scroll down" }) };
}

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

test("a press steps the viewport, then repeats while it is held", () => {
  const { viewport, down } = renderPane();

  fireEvent.pointerDown(down, { button: 0 });

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  advance(ARROW_STEP_REPEAT_DELAY_MS - 1); // An ordinary press must not outlast the delay and step twice.

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  advance(1);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);

  advance(ARROW_STEP_REPEAT_INTERVAL_MS);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 3);

  fireEvent.pointerUp(down);
  advance(ARROW_STEP_REPEAT_INTERVAL_MS * 4);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 3);
});

test("the click event that follows a press does not step a second time", () => {
  const { viewport, down } = renderPane();

  fireEvent.pointerDown(down, { button: 0 });
  fireEvent.pointerUp(down);
  fireEvent.click(down, { detail: 1 });

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);
});

test("a tap whose touch pointer events do not reach the control still plays a click sound", () => {
  const { viewport, down } = renderPane();

  fireEvent.click(down, { detail: 1 }); // The press landed outside, so only the click arrives.

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);
});

test("a browser-cancelled press scrolls once, and the following click scrolls again", () => {
  const { viewport, down } = renderPane();

  fireEvent.pointerDown(down, { button: 0 });
  fireEvent.pointerCancel(down);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  fireEvent.click(down, { detail: 1 });

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);
});

test("a step at the scroll boundary still plays a click sound", () => {
  const { viewport, down } = renderPane();

  viewport.scrollTop = MAX_SCROLL_TOP;
  fireEvent.pointerDown(down, { button: 0 });

  expect(viewport.scrollTop).toBe(MAX_SCROLL_TOP);
  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a keyboard activation steps the viewport", () => {
  const { viewport, down } = renderPane();

  fireEvent.click(down); // A keyboard-driven click reports no detail.

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);
});

// A press released outside the arrow's bounds does not deliver a click to clear the press it
// recorded, so a keyboard activation must not be mistaken for that press arriving late.
test("a keyboard activation steps the viewport after a press is abandoned outside the arrow", () => {
  const { viewport, down } = renderPane();

  fireEvent.pointerDown(down, { button: 0 });
  fireEvent.pointerLeave(down, { buttons: 1 });

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  fireEvent.click(down);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);
});

test("a held press keeps scrolling after leaving the arrow's bounds", () => {
  const { viewport, down } = renderPane();

  fireEvent.pointerDown(down, { button: 0 });
  advance(ARROW_STEP_REPEAT_DELAY_MS);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);

  fireEvent.pointerLeave(down, { buttons: 1 });
  advance(ARROW_STEP_REPEAT_INTERVAL_MS * 2);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 4);
});

test("a release away from the arrow's bounds ends the press", () => {
  const { viewport, down } = renderPane();

  fireEvent.pointerDown(down, { button: 0 });
  fireEvent.pointerLeave(down, { buttons: 1 });
  fireEvent.pointerUp(document.body);
  advance(ARROW_STEP_REPEAT_DELAY_MS + ARROW_STEP_REPEAT_INTERVAL_MS * 4);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);
});

// Releasing away from the arrow does not deliver a click event, so the press must not affect a later activation.
test("a press released away from the arrow does not affect the next activation", () => {
  const { viewport, down } = renderPane();

  fireEvent.pointerDown(down, { button: 0 });
  fireEvent.pointerUp(document.body);

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX);

  fireEvent.click(down, { detail: 1 }); // A tap iOS redirected to the arrow.

  expect(viewport.scrollTop).toBe(ARROW_STEP_PX * 2);
});
