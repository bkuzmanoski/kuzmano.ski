import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { useInputScrollSound } from "./use-input-scroll-sound";

const playInputScroll = vi.hoisted(() => vi.fn());
const silenceScrollAt = vi.hoisted(() => vi.fn());

vi.mock("./scroll", async (importOriginal) =>
  (await import("#/test-utils/audio")).audioModuleMock(importOriginal, { playInputScroll, silenceScrollAt }),
);

// A real control, so the handlers see the actual events React delivers.
function Input() {
  return <textarea aria-label="Field" {...useInputScrollSound<HTMLTextAreaElement>()} />;
}

function renderInput() {
  render(<Input />);
  return screen.getByLabelText<HTMLTextAreaElement>("Field");
}

// Lets the frame that clears an unclaimed mark run.
const nextFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

beforeEach(() => {
  playInputScroll.mockClear();
  silenceScrollAt.mockClear();
});

test("a scroll without a preceding key press plays the ordinary scroll sound", () => {
  const input = renderInput();

  fireEvent.scroll(input);

  expect(playInputScroll).toHaveBeenCalledWith(input);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test.each(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"])(
  "the scroll %s causes to keep the caret in view is silenced",
  (key) => {
    const input = renderInput();

    fireEvent.keyDown(input, { key });
    fireEvent.scroll(input);

    expect(silenceScrollAt).toHaveBeenCalledWith(input);
    expect(playInputScroll).not.toHaveBeenCalled();
  },
);

test("a key press that cannot move the caret out of view does not mark the next scroll", () => {
  const input = renderInput();

  fireEvent.keyDown(input, { key: "a" });
  fireEvent.scroll(input);

  expect(playInputScroll).toHaveBeenCalledWith(input);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test("a key press only silences the first scroll, not subsequent ones", () => {
  const input = renderInput();

  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.scroll(input);
  fireEvent.scroll(input);

  expect(silenceScrollAt).toHaveBeenCalledTimes(1);
  expect(playInputScroll).toHaveBeenCalledTimes(1);
});

test("a key press that does not cause scrolling clears its mark on the next frame", async () => {
  const input = renderInput();

  fireEvent.keyDown(input, { key: "ArrowDown" });
  await nextFrame();
  fireEvent.scroll(input);

  expect(playInputScroll).toHaveBeenCalledWith(input);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test("a held key press keeps its mark alive across repeats", async () => {
  const input = renderInput();

  fireEvent.keyDown(input, { key: "ArrowDown", repeat: true });
  await nextFrame();
  fireEvent.keyDown(input, { key: "ArrowDown", repeat: true });
  fireEvent.scroll(input);

  expect(silenceScrollAt).toHaveBeenCalledWith(input);
  expect(playInputScroll).not.toHaveBeenCalled();
});

test("an input that unmounts before its frame runs cancels its pending callback", () => {
  const cancelAnimationFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
  const { unmount } = render(<Input />);

  fireEvent.keyDown(screen.getByLabelText("Field"), { key: "ArrowDown" });
  unmount();

  expect(cancelAnimationFrame).toHaveBeenCalledOnce();
});
