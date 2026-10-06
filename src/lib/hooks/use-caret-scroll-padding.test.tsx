import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { nextAnimationFrame } from "#/test-utils/timers.ts";

import { useCaretScrollPadding } from "./use-caret-scroll-padding.ts";

const PADDING_TOP_PX = 12;
const PADDING_BOTTOM_PX = 20;
const LINE_HEIGHT_PX = 24;
const LINE_HEIGHT = `${LINE_HEIGHT_PX}px`;
const SCROLL_HEIGHT_PX = 500;
const CLIENT_HEIGHT_PX = 100;
const MAX_TOP_PX = SCROLL_HEIGHT_PX - CLIENT_HEIGHT_PX;

function Input({ lineHeight = LINE_HEIGHT, fontSize }: { lineHeight?: string; fontSize?: string }) {
  return (
    <textarea
      aria-label="Field"
      style={{ paddingTop: PADDING_TOP_PX, paddingBottom: PADDING_BOTTOM_PX, lineHeight, fontSize }}
      {...useCaretScrollPadding<HTMLTextAreaElement>()}
    />
  );
}

function renderInput(style: { lineHeight?: string; fontSize?: string } = {}) {
  render(<Input {...style} />);

  const input = screen.getByLabelText<HTMLTextAreaElement>("Field");

  let scrollHeight = SCROLL_HEIGHT_PX;
  let top = 0;

  Object.defineProperties(input, {
    scrollHeight: { get: () => scrollHeight },
    clientHeight: { get: () => CLIENT_HEIGHT_PX },
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        top = Math.min(Math.max(value, 0), scrollHeight - CLIENT_HEIGHT_PX);
      },
    },
  });

  return {
    input,
    resize: (height: number) => {
      scrollHeight = height;
    },
  };
}

function scrollTo(input: HTMLTextAreaElement, top: number) {
  input.scrollTop = top;
  fireEvent.scroll(input);
}

test("a downward scroll that follows an edit is extended by the bottom padding", () => {
  const { input } = renderInput();

  fireEvent.input(input);
  scrollTo(input, 200);

  expect(input.scrollTop).toBe(200 + PADDING_BOTTOM_PX);
});

test("a downward scroll that follows an edit and stops less than a line height plus the bottom padding from the end is extended to the end of the input", () => {
  const { input } = renderInput();

  fireEvent.input(input);
  scrollTo(input, MAX_TOP_PX - PADDING_BOTTOM_PX - LINE_HEIGHT_PX / 2);

  expect(input.scrollTop).toBe(MAX_TOP_PX);
});

test("a downward scroll that follows an edit and stops less than the font size plus the bottom padding from the end is extended to the end of the input when the `line-height` property is `normal`", () => {
  const fontSizePx = 30;
  const { input } = renderInput({ lineHeight: "normal", fontSize: `${fontSizePx}px` });

  fireEvent.input(input);
  scrollTo(input, MAX_TOP_PX - PADDING_BOTTOM_PX - fontSizePx / 2);

  expect(input.scrollTop).toBe(MAX_TOP_PX);
});

test("an upward scroll that follows an edit is extended by the top padding", () => {
  const { input } = renderInput();

  scrollTo(input, 300);
  fireEvent.input(input);
  scrollTo(input, 200);

  expect(input.scrollTop).toBe(200 - PADDING_TOP_PX);
});

test("an upward scroll that follows an edit and stops less than a line height plus the top padding from the start is extended to the start of the input", () => {
  const { input } = renderInput();

  scrollTo(input, 300);
  fireEvent.input(input);
  scrollTo(input, PADDING_TOP_PX + LINE_HEIGHT_PX / 2);

  expect(input.scrollTop).toBe(0);
});

test("an upward scroll that follows an edit and ends at the end of the input keeps its position", () => {
  const { input, resize } = renderInput();

  scrollTo(input, MAX_TOP_PX);
  resize(SCROLL_HEIGHT_PX - 50);
  fireEvent.input(input);
  scrollTo(input, MAX_TOP_PX - 50);

  expect(input.scrollTop).toBe(MAX_TOP_PX - 50);
});

test("a downward scroll that follows a press of the Down arrow key is extended by the bottom padding", () => {
  const { input } = renderInput();

  fireEvent.keyDown(input, { key: "ArrowDown" });
  scrollTo(input, 200);

  expect(input.scrollTop).toBe(200 + PADDING_BOTTOM_PX);
});

test("a scroll without a preceding edit or key press keeps its position", () => {
  const { input } = renderInput();

  scrollTo(input, 200);

  expect(input.scrollTop).toBe(200);
});

test("a scroll that follows a press of a key other than a caret scroll key keeps its position", () => {
  const { input } = renderInput();

  fireEvent.keyDown(input, { key: "a" });
  scrollTo(input, 200);

  expect(input.scrollTop).toBe(200);
});

test("an edit extends only the first scroll that follows it", () => {
  const { input } = renderInput();

  fireEvent.input(input);
  scrollTo(input, 100);

  expect(input.scrollTop).toBe(100 + PADDING_BOTTOM_PX);

  scrollTo(input, 200);

  expect(input.scrollTop).toBe(200);
});

test("a scroll a frame after an edit keeps its position", async () => {
  const { input } = renderInput();

  fireEvent.input(input);
  await nextAnimationFrame();
  scrollTo(input, 200);

  expect(input.scrollTop).toBe(200);
});

test("unmounting before the scroll mark is cleared cancels the pending frame", () => {
  const cancelAnimationFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
  const { unmount } = render(<Input />);

  fireEvent.input(screen.getByLabelText("Field"));
  unmount();

  expect(cancelAnimationFrame).toHaveBeenCalledOnce();
});
