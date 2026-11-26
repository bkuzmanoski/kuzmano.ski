import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { MOUSE_PRESS_INIT, SECOND_TOUCH_PRESS_INIT, TOUCH_PRESS_INIT } from "#/test-utils/press.ts";
import { advanceTimersBy } from "#/test-utils/timers.ts";

import { DRAG_THRESHOLD_PX, usePointerDrag } from "./use-pointer-drag.ts";

import type { PointerEvent as ReactPointerEvent } from "react";

const HANDLE_ID = "handle";
const PRESS = { x: 100, y: 50 };
const POINTER_ID = MOUSE_PRESS_INIT.pointerId;
const SECOND_POINTER_ID = SECOND_TOUCH_PRESS_INIT.pointerId;

/** The hook reports a move on the animation frame after the pointer event. */
const FRAME_MS = 16;

/**
 * `start` returns a value of the caller's choosing and the hook passes that same value to every move, so the tests
 * assert on its identity rather than its shape.
 */
const START_VALUE = { origin: "press" };

/** What `onEnd` receives for a drag that the browser did not cancel, whether or not it moved. */
const UNCANCELED_END = { start: START_VALUE, isCanceled: false };

const start = vi.fn<() => typeof START_VALUE | null>(() => START_VALUE);
const onDragMove = vi.fn();
const onEnd = vi.fn();

interface HandleProps {
  threshold?: number;
  preventDefault?: boolean;
  endsOnSecondTouch?: boolean;
  canStart?: (event: ReactPointerEvent) => boolean;
}

/**
 * The hook returns a press handler and nothing else; the rest of a gesture arrives on `window`. A bare element that
 * spreads the handler is therefore the whole of a consumer.
 */
function Handle({ threshold, preventDefault, endsOnSecondTouch, canStart }: HandleProps) {
  return (
    <div
      data-testid={HANDLE_ID}
      {...usePointerDrag({ threshold, preventDefault, endsOnSecondTouch, canStart, start, onDragMove, onEnd })}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  start.mockReset().mockReturnValue(START_VALUE);
  onDragMove.mockClear();
  onEnd.mockClear();
});

afterEach(() => vi.useRealTimers());

const renderHandle = (props: HandleProps = {}) => render(<Handle {...props} />);

const handle = () => screen.getByTestId(HANDLE_ID);

function press(init: PointerEventInit = MOUSE_PRESS_INIT) {
  fireEvent.pointerDown(handle(), { ...init, clientX: PRESS.x, clientY: PRESS.y });
}

interface Move {
  dx?: number;
  dy?: number;
  buttons?: number;
  pointerId?: number;
}

function movePointerBy({ dx = 0, dy = 0, buttons = 1, pointerId = POINTER_ID }: Move) {
  fireEvent.pointerMove(window, { buttons, pointerId, clientX: PRESS.x + dx, clientY: PRESS.y + dy });
}

function dragBy(move: Move) {
  movePointerBy(move);
  advanceTimersBy(FRAME_MS);
}

const release = ({ pointerId = POINTER_ID } = {}) => fireEvent.pointerUp(window, { pointerId });
const cancel = () => fireEvent.pointerCancel(window, { pointerId: POINTER_ID });

test("a pointer that travels no further than the threshold does not report a move", () => {
  renderHandle({ threshold: DRAG_THRESHOLD_PX });
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX - 1 });
  dragBy({ dy: DRAG_THRESHOLD_PX }); // The travel must exceed the threshold, not merely reach it.

  expect(onDragMove).not.toHaveBeenCalled();
});

test("a pointer that travels past the threshold reports the move that crossed it", () => {
  renderHandle({ threshold: DRAG_THRESHOLD_PX });
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX + 1 });

  expect(onDragMove).toHaveBeenCalledTimes(1);
  expect(onDragMove).toHaveBeenCalledWith({ dx: DRAG_THRESHOLD_PX + 1, dy: 0 }, START_VALUE);
});

test("a pointer that travels any distance reports its first move on a handle without a threshold", () => {
  renderHandle();
  press();
  dragBy({ dy: 1 });

  // The threshold exists for handles that also respond to a click; a handle with no threshold drags as soon as the
  // pointer travels at all.
  expect(onDragMove).toHaveBeenCalledWith({ dx: 0, dy: 1 }, START_VALUE);
});

test("each move reports its distance from the press point, alongside the value `start` returned at the press", () => {
  renderHandle();
  press();
  dragBy({ dx: 20, dy: 10 });
  dragBy({ dx: 35, dy: -4 });
  dragBy({ dx: 0, dy: 0 }); // Back at the press point, which is a delta like any other.

  expect(onDragMove.mock.calls).toEqual([
    [{ dx: 20, dy: 10 }, START_VALUE],
    [{ dx: 35, dy: -4 }, START_VALUE],
    [{ dx: 0, dy: 0 }, START_VALUE],
  ]);
  expect(start).toHaveBeenCalledTimes(1);
});

test("a release reports the drag as moved once the pointer has traveled past the threshold", () => {
  renderHandle({ threshold: DRAG_THRESHOLD_PX });
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX + 1 });
  release();

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true, UNCANCELED_END);
});

test("a release reports the drag as unmoved while the pointer stays within the threshold", () => {
  renderHandle({ threshold: DRAG_THRESHOLD_PX });
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX });
  release();

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(false, UNCANCELED_END);
});

test("a `pointercancel` event ends the drag and reports it as canceled", () => {
  renderHandle();
  press();
  dragBy({ dx: 20 });
  cancel();

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true, { start: START_VALUE, isCanceled: true });

  dragBy({ dx: 40 });

  expect(onDragMove).toHaveBeenCalledTimes(1);
});

test("a press with a secondary button does not start a drag", () => {
  renderHandle();
  press({ ...MOUSE_PRESS_INIT, button: 2 });
  dragBy({ dx: 20 });
  release();

  expect(start).not.toHaveBeenCalled();
  expect(onDragMove).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
});

test("a press for which `canStart` returns `false` does not start a drag", () => {
  renderHandle({ canStart: () => false });
  press();
  dragBy({ dx: 20 });

  expect(start).not.toHaveBeenCalled();
  expect(onDragMove).not.toHaveBeenCalled();
});

test("a move while no button is held ends the drag", () => {
  renderHandle();
  press();
  dragBy({ dx: 20 });
  dragBy({ dx: 40, buttons: 0 });

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true, UNCANCELED_END);
  expect(onDragMove).toHaveBeenCalledExactlyOnceWith({ dx: 20, dy: 0 }, START_VALUE);

  dragBy({ dx: 60 });

  expect(onDragMove).toHaveBeenCalledTimes(1);
});

test("moves within one frame report once, at the last position", () => {
  renderHandle();
  press();
  movePointerBy({ dx: 5 });
  movePointerBy({ dx: 10 });
  movePointerBy({ dx: 15 });

  expect(onDragMove).not.toHaveBeenCalled();

  advanceTimersBy(FRAME_MS);

  expect(onDragMove).toHaveBeenCalledExactlyOnceWith({ dx: 15, dy: 0 }, START_VALUE);
});

test("a pending move reports once, before the drag ends", () => {
  renderHandle();
  press();
  movePointerBy({ dx: 12, dy: 8 });
  release();

  expect(onDragMove).toHaveBeenCalledExactlyOnceWith({ dx: 12, dy: 8 }, START_VALUE);
  expect(onDragMove.mock.invocationCallOrder[0]).toBeLessThan(onEnd.mock.invocationCallOrder[0]!);

  advanceTimersBy(FRAME_MS); // The canceled frame must not report the same move a second time.

  expect(onDragMove).toHaveBeenCalledTimes(1);
});

test("a canceled drag does not report a pending move", () => {
  renderHandle();
  press();
  movePointerBy({ dx: 12, dy: 8 });
  cancel();
  advanceTimersBy(FRAME_MS);

  expect(onDragMove).not.toHaveBeenCalled();
  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true, { start: START_VALUE, isCanceled: true });
});

test("a move from a second pointer is not reported as a drag move", () => {
  renderHandle();
  press();
  dragBy({ dx: 20, pointerId: SECOND_POINTER_ID });

  expect(onDragMove).not.toHaveBeenCalled();
});

test("a release from a second pointer does not end the drag in flight", () => {
  renderHandle();
  press();
  dragBy({ dx: 20, pointerId: SECOND_POINTER_ID });
  release({ pointerId: SECOND_POINTER_ID });

  expect(onEnd).not.toHaveBeenCalled();
});

test("the pressing pointer still reports its moves after a second pointer has moved and released", () => {
  renderHandle();
  press();
  dragBy({ dx: 20, pointerId: SECOND_POINTER_ID });
  release({ pointerId: SECOND_POINTER_ID });
  dragBy({ dx: 20 });

  expect(onDragMove).toHaveBeenCalledExactlyOnceWith({ dx: 20, dy: 0 }, START_VALUE);
});

test("a press arriving mid-drag ends the drag in flight", () => {
  renderHandle();
  press();
  dragBy({ dx: 20 });
  press();

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true, UNCANCELED_END);
  expect(start).toHaveBeenCalledTimes(2);

  dragBy({ dx: 30 });

  expect(onDragMove).toHaveBeenLastCalledWith({ dx: 30, dy: 0 }, START_VALUE);
  expect(onDragMove).toHaveBeenCalledTimes(2);
});

test("a press for which `start` returns `null` does not prevent its default action, capture the pointer, or report a move or an end", () => {
  start.mockReturnValue(null);
  renderHandle({ preventDefault: true });

  const setPointerCapture = vi.spyOn(handle(), "setPointerCapture");
  const isDefaultAllowed = fireEvent.pointerDown(handle(), {
    ...MOUSE_PRESS_INIT,
    clientX: PRESS.x,
    clientY: PRESS.y,
  });

  dragBy({ dx: 20 });
  release();

  expect(isDefaultAllowed).toBe(true);
  expect(setPointerCapture).not.toHaveBeenCalled();
  expect(onDragMove).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
});

test("a second touch on the handle cancels the drag without preventing its default action or starting another drag when `endsOnSecondTouch` is `true`", () => {
  renderHandle({ preventDefault: true, endsOnSecondTouch: true });
  press(TOUCH_PRESS_INIT);
  dragBy({ dx: 20 });

  const isSecondTouchDefaultAllowed = fireEvent.pointerDown(handle(), {
    ...SECOND_TOUCH_PRESS_INIT,
    clientX: PRESS.x,
    clientY: PRESS.y,
  });

  expect(isSecondTouchDefaultAllowed).toBe(true);
  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true, { start: START_VALUE, isCanceled: true });
  expect(start).toHaveBeenCalledOnce();

  dragBy({ dx: 30, pointerId: SECOND_POINTER_ID });

  expect(onDragMove).toHaveBeenCalledOnce();
});

test("a second touch on another element cancels the drag when `endsOnSecondTouch` is `true`", () => {
  renderHandle({ endsOnSecondTouch: true });
  press(TOUCH_PRESS_INIT);
  dragBy({ dx: 20 });
  fireEvent.pointerDown(document.body, SECOND_TOUCH_PRESS_INIT);

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true, { start: START_VALUE, isCanceled: true });

  dragBy({ dx: 30 });

  expect(onDragMove).toHaveBeenCalledOnce();
});

test("a second touch on another element does not cancel the drag when `endsOnSecondTouch` is `false`", () => {
  renderHandle();
  press(TOUCH_PRESS_INIT);
  fireEvent.pointerDown(document.body, SECOND_TOUCH_PRESS_INIT);
  dragBy({ dx: 20 });

  expect(onEnd).not.toHaveBeenCalled();
  expect(onDragMove).toHaveBeenCalledOnce();
});

test("a touch on another element does not cancel a mouse drag when `endsOnSecondTouch` is `true`", () => {
  renderHandle({ endsOnSecondTouch: true });
  press();
  fireEvent.pointerDown(document.body, SECOND_TOUCH_PRESS_INIT);
  dragBy({ dx: 20 });

  expect(onEnd).not.toHaveBeenCalled();
  expect(onDragMove).toHaveBeenCalledOnce();
});

test("unmounting during a drag stops reporting the gesture", () => {
  const { unmount } = renderHandle();

  press();
  movePointerBy({ dx: 20 });
  unmount();
  advanceTimersBy(FRAME_MS);
  dragBy({ dx: 40 });
  release();

  expect(onDragMove).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
});
