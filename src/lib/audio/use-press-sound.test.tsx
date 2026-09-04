import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClick } from "./sounds.ts";
import { usePressSound } from "./use-press-sound.ts";

vi.mock("./sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => vi.mocked(playClick).mockClear());

const CLICK = { detail: 1 }; // A pointer click, as opposed to keyboard activation.

function Control({ scrollSafe = false }) {
  return (
    <button type="button" {...usePressSound({ scrollSafe })}>
      Press
    </button>
  );
}

const renderControl = ({ scrollSafe = false } = {}) => {
  render(<Control scrollSafe={scrollSafe} />);
  return screen.getByRole("button", { name: "Press" });
};

test("a press plays a sound once on pointer down, and not again on pointer up or click", () => {
  const control = renderControl();

  fireEvent.pointerDown(control);

  expect(playClick).toHaveBeenCalledTimes(1);

  fireEvent.pointerUp(control);
  fireEvent.click(control, CLICK);

  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a pointer click event without a preceding pointer down event plays a sound", () => {
  fireEvent.click(renderControl(), CLICK);
  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a keyboard activation does not play a sound", () => {
  fireEvent.click(renderControl());
  expect(playClick).not.toHaveBeenCalled();
});

test("a cancelled pointer down event lets the next pointer click event play a sound", () => {
  const control = renderControl();

  fireEvent.pointerDown(control);
  fireEvent.pointerCancel(control);

  expect(playClick).toHaveBeenCalledTimes(1);

  fireEvent.click(control, CLICK);

  expect(playClick).toHaveBeenCalledTimes(2);
});

test("a non-primary press does not play a sound", () => {
  fireEvent.pointerDown(renderControl(), { button: 2 });

  expect(playClick).not.toHaveBeenCalled();
});

test("a scroll-safe control defers a touch press until release", () => {
  const control = renderControl({ scrollSafe: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });

  expect(playClick).not.toHaveBeenCalled();

  fireEvent.pointerUp(control, { pointerType: "touch" });
  fireEvent.click(control, CLICK);

  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a scroll-safe control does not play a touch press that becomes a scroll", () => {
  const control = renderControl({ scrollSafe: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerCancel(control, { pointerType: "touch" });

  expect(playClick).not.toHaveBeenCalled();
});

test("a scroll-safe control plays a sound for a mouse press on pointer down", () => {
  const control = renderControl({ scrollSafe: true });

  fireEvent.pointerDown(control, { pointerType: "mouse" });

  expect(playClick).toHaveBeenCalledTimes(1);

  fireEvent.pointerUp(control, { pointerType: "mouse" });
  fireEvent.click(control, CLICK);

  expect(playClick).toHaveBeenCalledTimes(1);
});

test("a scroll-safe control plays a sound for a tap retargeted to it by iOS", () => {
  fireEvent.click(renderControl({ scrollSafe: true }), CLICK);
  expect(playClick).toHaveBeenCalledTimes(1);
});
