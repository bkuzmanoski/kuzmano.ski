import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DETENT_PIXELS, IDLE_DURATION_MS } from "#/lib/audio/scroll.ts";

import { ScrollPane } from "./scroll-pane.tsx";

const playScrollDetent = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { playScrollDetent }),
);

let now = 0;

beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  playScrollDetent.mockClear();
});

function renderPane() {
  render(
    <ScrollPane id="pane">
      <button type="button">First</button>
      <button type="button">Second</button>
    </ScrollPane>,
  );

  const viewport = document.getElementById("pane")!;

  Object.defineProperty(viewport, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(viewport, "clientHeight", { value: 100, configurable: true });

  fireEvent.scroll(viewport); // The pane's first scroll event opens a gesture.

  return viewport;
}

function focusJump(viewport: HTMLElement, item: HTMLElement, to: number, afterMs: number) {
  now += afterMs;
  fireEvent.focus(item);
  viewport.scrollTop = to;
  fireEvent.scroll(viewport);
}

const detents = () => playScrollDetent.mock.calls.length;

test("a tab key press into content below the fold does not play a sound for the scroll that reaches it", () => {
  const viewport = renderPane();
  const [first, second] = screen.getAllByRole("button");

  focusJump(viewport, first!, DETENT_PIXELS * 4, IDLE_DURATION_MS * 2);

  expect(detents()).toBe(0);

  focusJump(viewport, second!, DETENT_PIXELS * 8, IDLE_DURATION_MS * 2);

  expect(detents()).toBe(0);
});

// Safari animates the scroll that reveals a focused element, so it arrives as a run of scroll
// events after the focus rather than as one jump before it.
test("an animated scroll into view stays silent for as long as it runs", () => {
  const viewport = renderPane();
  const [first] = screen.getAllByRole("button");

  now += IDLE_DURATION_MS * 2;
  fireEvent.focus(first!); // The viewport has not moved yet, so there is no position to record.

  for (let frame = 1; frame <= 10; frame += 1) {
    now += 16;
    viewport.scrollTop = DETENT_PIXELS * frame;
    fireEvent.scroll(viewport);
  }

  expect(detents()).toBe(0);
});

test("user scrolling plays a sound again after an animated scroll into view settles", () => {
  const viewport = renderPane();
  const [first] = screen.getAllByRole("button");

  now += IDLE_DURATION_MS * 2;
  fireEvent.focus(first!);

  now += 16;
  viewport.scrollTop = DETENT_PIXELS * 4;
  fireEvent.scroll(viewport);

  now += IDLE_DURATION_MS * 2; // The animation has settled.
  viewport.scrollTop = DETENT_PIXELS * 5;
  fireEvent.scroll(viewport);

  expect(detents()).toBe(0); // The scroll that reopens the gesture is not itself a detent.

  now += 16;
  viewport.scrollTop = DETENT_PIXELS * 6;
  fireEvent.scroll(viewport);

  expect(detents()).toBe(1);
});

test("a held tab key does not play a sound for the scrolls its repeats cause", () => {
  const viewport = renderPane();
  const [first, second] = screen.getAllByRole("button");

  focusJump(viewport, first!, DETENT_PIXELS * 4, IDLE_DURATION_MS * 2);
  focusJump(viewport, second!, DETENT_PIXELS * 8, 30);

  expect(detents()).toBe(0);
});

test("the user's own scrolling still plays a sound", () => {
  const viewport = renderPane();

  now += 16;
  viewport.scrollTop = DETENT_PIXELS;
  fireEvent.scroll(viewport);

  expect(detents()).toBe(1);
});
