import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { useFieldScrollSound } from "./use-field-scroll-sound";

const playFieldScroll = vi.hoisted(() => vi.fn());
const silenceScrollAt = vi.hoisted(() => vi.fn());

vi.mock("./scroll", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playFieldScroll, silenceScrollAt }),
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
  silenceScrollAt.mockClear();
});

test("a scroll without a preceding key press plays the ordinary scroll sound", () => {
  const field = renderField();

  fireEvent.scroll(field);

  expect(playFieldScroll).toHaveBeenCalledWith(field);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test.each(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"])(
  "the scroll %s causes to keep the caret in view is silenced",
  (key) => {
    const field = renderField();

    fireEvent.keyDown(field, { key });
    fireEvent.scroll(field);

    expect(silenceScrollAt).toHaveBeenCalledWith(field);
    expect(playFieldScroll).not.toHaveBeenCalled();
  },
);

test("a key press that cannot move the caret out of view does not mark the next scroll", () => {
  const field = renderField();

  fireEvent.keyDown(field, { key: "a" });
  fireEvent.scroll(field);

  expect(playFieldScroll).toHaveBeenCalledWith(field);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test("a key press only silences the first scroll, so the next plays its sound", () => {
  const field = renderField();

  fireEvent.keyDown(field, { key: "ArrowDown" });
  fireEvent.scroll(field);
  fireEvent.scroll(field);

  expect(silenceScrollAt).toHaveBeenCalledTimes(1);
  expect(playFieldScroll).toHaveBeenCalledTimes(1);
});

test("a key press that does not cause scrolling clears its mark on the next frame", async () => {
  const field = renderField();

  fireEvent.keyDown(field, { key: "ArrowDown" });
  await nextFrame();
  fireEvent.scroll(field);

  expect(playFieldScroll).toHaveBeenCalledWith(field);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test("a held key press keeps its mark alive across repeats", async () => {
  const field = renderField();

  fireEvent.keyDown(field, { key: "ArrowDown", repeat: true });
  await nextFrame();
  fireEvent.keyDown(field, { key: "ArrowDown", repeat: true });
  fireEvent.scroll(field);

  expect(silenceScrollAt).toHaveBeenCalledWith(field);
  expect(playFieldScroll).not.toHaveBeenCalled();
});

test("a field that unmounts before its frame runs cancels its pending callback", () => {
  const cancelAnimationFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
  const { unmount } = render(<Field />);

  fireEvent.keyDown(screen.getByLabelText("Field"), { key: "ArrowDown" });
  unmount();

  expect(cancelAnimationFrame).toHaveBeenCalledOnce();
});
