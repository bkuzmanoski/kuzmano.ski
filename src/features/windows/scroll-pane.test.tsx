import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { DETENT_PX, IDLE_DURATION_MS } from "#/lib/audio/scroll.ts";

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

const detents = () => playScrollDetent.mock.calls.length;

test("focusing an element in the pane silences the scroll that brings it into view", () => {
  const viewport = renderPane();
  const [first] = screen.getAllByRole("button");

  now += IDLE_DURATION_MS * 2;
  fireEvent.focus(first!); // The viewport has not moved yet, so there is no position to record.

  for (let frame = 1; frame <= 10; frame += 1) {
    now += 16;
    viewport.scrollTop = DETENT_PX * frame;
    fireEvent.scroll(viewport);
  }

  expect(detents()).toBe(0);
});

test("the user's own scrolling still plays a sound", () => {
  const viewport = renderPane();

  now += 16;
  viewport.scrollTop = DETENT_PX;
  fireEvent.scroll(viewport);

  expect(detents()).toBe(1);
});
