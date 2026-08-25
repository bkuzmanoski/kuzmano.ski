import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DETENT_PIXELS, IDLE_MS } from "#/lib/audio/scroll";

import { ScrollPane } from "./scroll-pane";

const playScrollDetent = vi.hoisted(() => vi.fn());

vi.mock("#/lib/audio/sounds", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playScrollDetent }),
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

test("tabbing into content below the fold does not sound the scroll that reaches it", () => {
  const viewport = renderPane();
  const [first, second] = screen.getAllByRole("button");

  focusJump(viewport, first!, DETENT_PIXELS * 4, IDLE_MS * 2);

  expect(detents()).toBe(0);

  focusJump(viewport, second!, DETENT_PIXELS * 8, IDLE_MS * 2);

  expect(detents()).toBe(0);
});

test("a held tab key does not sound the scrolls its repeats cause", () => {
  const viewport = renderPane();
  const [first, second] = screen.getAllByRole("button");

  focusJump(viewport, first!, DETENT_PIXELS * 4, IDLE_MS * 2);
  focusJump(viewport, second!, DETENT_PIXELS * 8, 30);

  expect(detents()).toBe(0);
});

test("the user's own scrolling still sounds", () => {
  const viewport = renderPane();

  now += 16;
  viewport.scrollTop = DETENT_PIXELS;
  fireEvent.scroll(viewport);

  expect(detents()).toBe(1);
});
