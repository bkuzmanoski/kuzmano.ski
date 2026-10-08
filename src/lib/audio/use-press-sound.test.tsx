import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { playClickSound } from "./sounds.ts";
import { usePressSound } from "./use-press-sound.ts";

vi.mock("./sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => vi.mocked(playClickSound).mockClear());

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

  expect(playClickSound).toHaveBeenCalledTimes(1);

  fireEvent.pointerUp(control);
  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a pointer click event without a preceding pointer down event plays a sound", () => {
  fireEvent.click(renderControl(), CLICK);
  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a keyboard activation with Enter or Space plays a sound once", () => {
  const control = renderControl();

  fireEvent.keyDown(control, { key: "Enter" });
  fireEvent.click(control);

  expect(playClickSound).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(control, { key: " " });
  fireEvent.keyUp(control, { key: " " });
  fireEvent.click(control);

  expect(playClickSound).toHaveBeenCalledTimes(2);
});

test("a click event without a preceding pointer or activation key press does not play a sound", () => {
  const control = renderControl();

  fireEvent.keyDown(control, { key: "a" });
  fireEvent.click(control);

  expect(playClickSound).not.toHaveBeenCalled();
});

test("an activation key pressed before the control loses focus does not play a sound on a later click event", () => {
  const control = renderControl();

  fireEvent.keyDown(control, { key: " " });
  fireEvent.blur(control);
  fireEvent.click(control);

  expect(playClickSound).not.toHaveBeenCalled();
});

test("a canceled pointer down event lets the next pointer click event play a sound", () => {
  const control = renderControl();

  fireEvent.pointerDown(control);
  fireEvent.pointerCancel(control);

  expect(playClickSound).toHaveBeenCalledTimes(1);

  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(2);
});

test("a non-primary press does not play a sound", () => {
  fireEvent.pointerDown(renderControl(), { button: 2 });

  expect(playClickSound).not.toHaveBeenCalled();
});

test("a scroll-safe control plays a sound for a touch press on its `click` event", () => {
  const control = renderControl({ scrollSafe: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerUp(control, { pointerType: "touch" });

  expect(playClickSound).not.toHaveBeenCalled();

  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

// A touch that stops a scroll in motion ends without a `click` event.
test("a scroll-safe control does not play a sound for a touch press that ends without a `click` event", () => {
  const control = renderControl({ scrollSafe: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerUp(control, { pointerType: "touch" });

  expect(playClickSound).not.toHaveBeenCalled();
});

test("a scroll-safe control does not play a sound for a canceled touch press", () => {
  const control = renderControl({ scrollSafe: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerCancel(control, { pointerType: "touch" });

  expect(playClickSound).not.toHaveBeenCalled();
});

test("a scroll-safe control plays a sound for a mouse press on pointer down", () => {
  const control = renderControl({ scrollSafe: true });

  fireEvent.pointerDown(control, { pointerType: "mouse" });

  expect(playClickSound).toHaveBeenCalledTimes(1);

  fireEvent.pointerUp(control, { pointerType: "mouse" });
  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a scroll-safe control plays one sound for a mouse press after a touch press whose `click` event went to another control", () => {
  const control = renderControl({ scrollSafe: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerUp(control, { pointerType: "touch" }); // iOS dispatches the tap's `click` to another control.
  fireEvent.pointerDown(control, { pointerType: "mouse" });
  fireEvent.pointerUp(control, { pointerType: "mouse" });
  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a scroll-safe control plays a sound for a tap retargeted to it by iOS", () => {
  fireEvent.click(renderControl({ scrollSafe: true }), CLICK);
  expect(playClickSound).toHaveBeenCalledTimes(1);
});
