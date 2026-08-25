import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { useFieldScrollSound } from "./use-field-scroll-sound";

const playFieldScroll = vi.hoisted(() => vi.fn());
const skipScrollAt = vi.hoisted(() => vi.fn());

vi.mock("./scroll", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playFieldScroll, skipScrollAt }),
);

// A real control, so the handlers see the events React actually delivers.
function Field() {
  return <textarea aria-label="Field" {...useFieldScrollSound<HTMLTextAreaElement>()} />;
}

function renderField() {
  render(<Field />);
  return screen.getByLabelText<HTMLTextAreaElement>("Field");
}

// Lets the frame that clears an unclaimed mark run.
const nextFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

beforeEach(() => {
  playFieldScroll.mockClear();
  skipScrollAt.mockClear();
});

test("a scroll with no caret-moving key before it sounds like ordinary scrolling", () => {
  const field = renderField();

  fireEvent.scroll(field);

  expect(playFieldScroll).toHaveBeenCalledWith(field);
  expect(skipScrollAt).not.toHaveBeenCalled();
});

test.each(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"])(
  "the scroll %s causes to keep the caret in view is skipped instead of sounded",
  (key) => {
    const field = renderField();

    fireEvent.keyDown(field, { key });
    fireEvent.scroll(field);

    expect(skipScrollAt).toHaveBeenCalledWith(field);
    expect(playFieldScroll).not.toHaveBeenCalled();
  },
);

test("a key that cannot move the caret out of view does not mark the next scroll", () => {
  const field = renderField();

  fireEvent.keyDown(field, { key: "a" });
  fireEvent.scroll(field);

  expect(playFieldScroll).toHaveBeenCalledWith(field);
  expect(skipScrollAt).not.toHaveBeenCalled();
});

test("the mark is spent by the first scroll, so a second one sounds normally", () => {
  const field = renderField();

  fireEvent.keyDown(field, { key: "ArrowDown" });
  fireEvent.scroll(field);
  fireEvent.scroll(field);

  expect(skipScrollAt).toHaveBeenCalledTimes(1);
  expect(playFieldScroll).toHaveBeenCalledTimes(1);
});

test("a key that scrolls nothing clears its mark on the next frame", async () => {
  const field = renderField();

  fireEvent.keyDown(field, { key: "ArrowDown" });
  await nextFrame();
  fireEvent.scroll(field);

  expect(playFieldScroll).toHaveBeenCalledWith(field);
  expect(skipScrollAt).not.toHaveBeenCalled();
});

test("a held key keeps its mark alive across repeats", async () => {
  const field = renderField();

  fireEvent.keyDown(field, { key: "ArrowDown", repeat: true });
  await nextFrame();
  fireEvent.keyDown(field, { key: "ArrowDown", repeat: true });
  fireEvent.scroll(field);

  expect(skipScrollAt).toHaveBeenCalledWith(field);
  expect(playFieldScroll).not.toHaveBeenCalled();
});

test("a field that unmounts before its frame runs cancels its pending callback", () => {
  const cancelAnimationFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
  const { unmount } = render(<Field />);

  fireEvent.keyDown(screen.getByLabelText("Field"), { key: "ArrowDown" });
  unmount();

  expect(cancelAnimationFrame).toHaveBeenCalledOnce();
});
