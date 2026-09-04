import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { DRAG_THRESHOLD_PX, usePointerDrag } from "./use-pointer-drag.ts";

import type { PointerEvent as ReactPointerEvent } from "react";

const HANDLE_ID = "handle";
const PRESS = { x: 100, y: 50 };
const POINTER_ID = 1;
const SECOND_POINTER_ID = 2;
const FRAME_MS = 16; // A move is reported on the animation frame after the pointer event.

// `start` returns a value of the caller's choosing and the hook passes that same value to every
// move, so the tests assert on its identity rather than its shape.
const START_VALUE = { origin: "press" };

const start = vi.fn(() => START_VALUE);
const onDragMove = vi.fn();
const onEnd = vi.fn();

interface HandleProps {
  threshold?: number;
  canStart?: (event: ReactPointerEvent) => boolean;
}

// The hook returns a press handler and nothing else; the rest of a gesture arrives on `window`. A
// bare element that spreads the handler is therefore the whole of a consumer.
function Handle({ threshold, canStart }: HandleProps) {
  return <div data-testid={HANDLE_ID} {...usePointerDrag({ threshold, canStart, start, onDragMove, onEnd })} />;
}

beforeEach(() => {
  vi.useFakeTimers();
  start.mockClear();
  onDragMove.mockClear();
  onEnd.mockClear();
});

afterEach(() => vi.useRealTimers());

const renderHandle = (props: HandleProps = {}) => render(<Handle {...props} />);

const handle = () => screen.getByTestId(HANDLE_ID);

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function press({ button = 0, pointerId = POINTER_ID } = {}) {
  fireEvent.pointerDown(handle(), { button, pointerId, clientX: PRESS.x, clientY: PRESS.y });
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
  advance(FRAME_MS);
}

const release = ({ pointerId = POINTER_ID } = {}) => fireEvent.pointerUp(window, { pointerId });

test("a pointer that travels no further than the threshold reports no move", () => {
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

// The threshold exists for handles that also respond to a click; a handle with no
// threshold drags as soon as the pointer travels at all.
test("the first move of any distance drags a handle with no threshold", () => {
  renderHandle();
  press();
  dragBy({ dy: 1 });

  expect(onDragMove).toHaveBeenCalledWith({ dx: 0, dy: 1 }, START_VALUE);
});

test("each move reports its distance from the press point, alongside the value the press recorded", () => {
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

test("a release reports the drag as moved once the pointer has travelled past the threshold", () => {
  renderHandle({ threshold: DRAG_THRESHOLD_PX });
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX + 1 });
  release();

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true);
});

test("a release reports the drag as unmoved while the pointer stays within the threshold", () => {
  renderHandle({ threshold: DRAG_THRESHOLD_PX });
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX });
  release();

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(false);
});

test("a press with a secondary button starts no drag", () => {
  renderHandle();
  press({ button: 2 });
  dragBy({ dx: 20 });
  release();

  expect(start).not.toHaveBeenCalled();
  expect(onDragMove).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
});

test("a press that canStart refuses starts no drag", () => {
  renderHandle({ canStart: () => false });
  press();
  dragBy({ dx: 20 });

  expect(start).not.toHaveBeenCalled();
  expect(onDragMove).not.toHaveBeenCalled();
});

// The release reached no listener of this drag, so the next move is the first evidence the drag is over.
test("a move arriving with no button held ends the drag", () => {
  renderHandle();
  press();
  dragBy({ dx: 20 });
  dragBy({ dx: 40, buttons: 0 });

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true);
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

  advance(FRAME_MS);

  expect(onDragMove).toHaveBeenCalledExactlyOnceWith({ dx: 15, dy: 0 }, START_VALUE);
});

// The last position of a gesture is the one that matters most, so it must not be lost to a frame whose callback never runs.
test("a move still waiting for its frame reports before the drag ends", () => {
  renderHandle();
  press();
  movePointerBy({ dx: 12, dy: 8 });
  release();

  expect(onDragMove).toHaveBeenCalledExactlyOnceWith({ dx: 12, dy: 8 }, START_VALUE);
  expect(onDragMove.mock.invocationCallOrder[0]).toBeLessThan(onEnd.mock.invocationCallOrder[0]!);

  advance(FRAME_MS); // The cancelled frame must not report the same move a second time.

  expect(onDragMove).toHaveBeenCalledTimes(1);
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

// Only one gesture may be in flight, so the earlier one is closed out rather than left listening.
test("a press arriving mid-drag ends the drag in flight", () => {
  renderHandle();
  press();
  dragBy({ dx: 20 });
  press();

  expect(onEnd).toHaveBeenCalledExactlyOnceWith(true);
  expect(start).toHaveBeenCalledTimes(2);

  dragBy({ dx: 30 });

  expect(onDragMove).toHaveBeenLastCalledWith({ dx: 30, dy: 0 }, START_VALUE);
  expect(onDragMove).toHaveBeenCalledTimes(2); // The abandoned drag's listeners are gone, so the move reports once.
});

test("unmounting during a drag stops reporting the gesture", () => {
  const { unmount } = renderHandle();

  press();
  movePointerBy({ dx: 20 });
  unmount();
  advance(FRAME_MS);
  dragBy({ dx: 40 });
  release();

  expect(onDragMove).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
});
