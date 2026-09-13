import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { useInputScrollSound } from "./use-input-scroll-sound.ts";

const playInputScroll = vi.hoisted(() => vi.fn());
const silenceScrollAt = vi.hoisted(() => vi.fn());

vi.mock("./scroll.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, { playInputScroll, silenceScrollAt }),
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

test("a scroll without a preceding key press plays the scroll sound", () => {
  const input = renderInput();

  fireEvent.scroll(input);

  expect(playInputScroll).toHaveBeenCalledWith(input);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test.each(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"])(
  "a scroll that follows a %s key press does not play the scroll sound",
  (key) => {
    const input = renderInput();

    fireEvent.keyDown(input, { key });
    fireEvent.scroll(input);

    expect(silenceScrollAt).toHaveBeenCalledWith(input);
    expect(playInputScroll).not.toHaveBeenCalled();
  },
);

test("a scroll that follows a key press that cannot move the caret out of view plays the scroll sound", () => {
  const input = renderInput();

  fireEvent.keyDown(input, { key: "a" });
  fireEvent.scroll(input);

  expect(playInputScroll).toHaveBeenCalledWith(input);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test("a key press silences only the first scroll that follows it", () => {
  const input = renderInput();

  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.scroll(input);
  fireEvent.scroll(input);

  expect(silenceScrollAt).toHaveBeenCalledTimes(1);
  expect(playInputScroll).toHaveBeenCalledTimes(1);
});

test("a scroll a frame after a key press plays the scroll sound", async () => {
  const input = renderInput();

  fireEvent.keyDown(input, { key: "ArrowDown" });
  await nextFrame();
  fireEvent.scroll(input);

  expect(playInputScroll).toHaveBeenCalledWith(input);
  expect(silenceScrollAt).not.toHaveBeenCalled();
});

test("a scroll that follows a repeated key press does not play the scroll sound, even a frame after the previous repeat", async () => {
  const input = renderInput();

  fireEvent.keyDown(input, { key: "ArrowDown", repeat: true });
  await nextFrame();
  fireEvent.keyDown(input, { key: "ArrowDown", repeat: true });
  fireEvent.scroll(input);

  expect(silenceScrollAt).toHaveBeenCalledWith(input);
  expect(playInputScroll).not.toHaveBeenCalled();
});

test("unmounting before the scroll mark is cleared cancels the pending frame", () => {
  const cancelAnimationFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
  const { unmount } = render(<Input />);

  fireEvent.keyDown(screen.getByLabelText("Field"), { key: "ArrowDown" });
  unmount();

  expect(cancelAnimationFrame).toHaveBeenCalledOnce();
});
