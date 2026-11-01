import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SCREEN_READER_ACTIVATIONS, pressWithMouse } from "#/test-utils/press.ts";

import { playClickSound } from "./sounds.ts";
import { usePressSound, usePressSoundPlayer } from "./use-press-sound.ts";

vi.mock("./sounds.ts", async (importOriginal) =>
  (await import("#/test-utils/audio.ts")).audioModuleMock(importOriginal, {}),
);

beforeEach(() => vi.mocked(playClickSound).mockClear());

/** A pointer click, as opposed to keyboard activation. */
const CLICK = { detail: 1 };

function Control({ defersTouchPressSound = false, disabled = false }) {
  return (
    <button type="button" disabled={disabled} {...usePressSound({ defersTouchPressSound })}>
      Press
    </button>
  );
}

function SilentBrowserHandledPressControl() {
  return (
    <a href="/page" {...usePressSound({ silencesBrowserHandledPress: true })}>
      Press
    </a>
  );
}

const renderControl = ({ defersTouchPressSound = false } = {}) => {
  render(<Control defersTouchPressSound={defersTouchPressSound} />);
  return screen.getByRole("button", { name: "Press" });
};

test("a touch press plays a sound once on pointer down, and not again on mouse down, pointer up, or click", () => {
  const control = renderControl();

  fireEvent.pointerDown(control, { pointerType: "touch" });

  expect(playClickSound).toHaveBeenCalledTimes(1);

  fireEvent.mouseDown(control, CLICK);
  fireEvent.pointerUp(control, { pointerType: "touch" });
  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a mouse press plays a sound once on mouse down, and not on pointer down, pointer up, or click", () => {
  const control = renderControl();

  fireEvent.pointerDown(control, { pointerType: "mouse" });

  expect(playClickSound).not.toHaveBeenCalled();

  fireEvent.mouseDown(control, CLICK);

  expect(playClickSound).toHaveBeenCalledOnce();

  fireEvent.pointerUp(control, { pointerType: "mouse" });
  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledOnce();
});

test.each(SCREEN_READER_ACTIVATIONS)(
  "a screen reader's activate action in %s does not play a sound",
  (_browser, activate) => {
    activate(renderControl());
    expect(playClickSound).not.toHaveBeenCalled();
  },
);

test("a pointer click event without a preceding pointer down event plays a sound", () => {
  fireEvent.click(renderControl(), CLICK);
  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a control with `silencesBrowserHandledPress` plays a sound for a press without a modifier key", () => {
  render(<SilentBrowserHandledPressControl />);
  pressWithMouse(screen.getByRole("link", { name: "Press" }));

  expect(playClickSound).toHaveBeenCalledOnce();
});

test("a control with `silencesBrowserHandledPress` does not play a sound for a press with a modifier key, or its `click` event", () => {
  render(<SilentBrowserHandledPressControl />);

  const control = screen.getByRole("link", { name: "Press" });

  fireEvent.pointerDown(control, { pointerType: "mouse", metaKey: true });
  fireEvent.mouseDown(control, { detail: 1, metaKey: true });
  fireEvent.click(control, { detail: 1, metaKey: true });

  expect(playClickSound).not.toHaveBeenCalled();
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

test.for([
  ["its `disabled` attribute", <Control disabled />],
  [
    "a disabled `<fieldset>`",
    <fieldset disabled>
      <Control />
    </fieldset>,
  ],
] as const)("a press on a control disabled by %s does not play a sound", ([, control]) => {
  render(control);

  const button = screen.getByRole("button", { name: "Press" });

  fireEvent.pointerDown(button);

  expect(button.matches(":disabled")).toBe(true);
  expect(playClickSound).not.toHaveBeenCalled();
});

test("a control with `defersTouchPressSound` plays a sound for a touch press on its `click` event", () => {
  const control = renderControl({ defersTouchPressSound: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerUp(control, { pointerType: "touch" });

  expect(playClickSound).not.toHaveBeenCalled();

  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

// A touch that stops a scroll in motion ends without a `click` event.
test("a control with `defersTouchPressSound` does not play a sound for a touch press that ends without a `click` event", () => {
  const control = renderControl({ defersTouchPressSound: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerUp(control, { pointerType: "touch" });

  expect(playClickSound).not.toHaveBeenCalled();
});

test("a control with `defersTouchPressSound` does not play a sound for a canceled touch press", () => {
  const control = renderControl({ defersTouchPressSound: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerCancel(control, { pointerType: "touch" });

  expect(playClickSound).not.toHaveBeenCalled();
});

test("a control with `defersTouchPressSound` plays a sound for a mouse press on mouse down", () => {
  const control = renderControl({ defersTouchPressSound: true });

  pressWithMouse(control);

  expect(playClickSound).toHaveBeenCalledTimes(1);

  fireEvent.pointerUp(control, { pointerType: "mouse" });
  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a control with `defersTouchPressSound` plays one sound for a mouse press after a touch press whose `click` event went to another control", () => {
  const control = renderControl({ defersTouchPressSound: true });

  fireEvent.pointerDown(control, { pointerType: "touch" });
  fireEvent.pointerUp(control, { pointerType: "touch" }); // iOS dispatches the tap's `click` to another control.
  pressWithMouse(control);
  fireEvent.pointerUp(control, { pointerType: "mouse" });
  fireEvent.click(control, CLICK);

  expect(playClickSound).toHaveBeenCalledTimes(1);
});

test("a control with `defersTouchPressSound` plays a sound for a tap retargeted to it by iOS", () => {
  fireEvent.click(renderControl({ defersTouchPressSound: true }), CLICK);
  expect(playClickSound).toHaveBeenCalledTimes(1);
});

describe("playPendingTouchPressSound", () => {
  function PendingSoundControl() {
    const { handlers, playPendingTouchPressSound } = usePressSoundPlayer({ defersTouchPressSound: true });

    return (
      <>
        <button type="button" {...handlers}>
          Press
        </button>
        <button type="button" onClick={playPendingTouchPressSound}>
          Play pending
        </button>
      </>
    );
  }

  const playPending = () => fireEvent.click(screen.getByRole("button", { name: "Play pending" }));

  test("plays the sound of a deferred touch press only once", () => {
    render(<PendingSoundControl />);

    const control = screen.getByRole("button", { name: "Press" });

    fireEvent.pointerDown(control, { pointerType: "touch" });
    playPending();

    expect(playClickSound).toHaveBeenCalledOnce();

    playPending();

    expect(playClickSound).toHaveBeenCalledOnce();
  });

  test("does not play the sound again for a mouse press, which plays it on `mousedown`", () => {
    render(<PendingSoundControl />);
    pressWithMouse(screen.getByRole("button", { name: "Press" }));
    playPending();

    expect(playClickSound).toHaveBeenCalledOnce();
  });
});
