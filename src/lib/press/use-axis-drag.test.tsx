import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { MOUSE_PRESS_INIT, TOUCH_PRESS_INIT } from "#/test-utils/press.ts";
import { advanceTimersBy } from "#/test-utils/timers.ts";

import { useAxisDrag } from "./use-axis-drag.ts";
import { DRAG_THRESHOLD_PX } from "./use-pointer-drag.ts";

import type { DragAxis } from "./use-axis-drag.ts";

const onBegin = vi.fn();
const onDragMove = vi.fn();
const onEnd = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  onBegin.mockClear();
  onDragMove.mockClear();
  onEnd.mockClear();
});

afterEach(() => vi.useRealTimers());

const HANDLE_ID = "handle";
const PRESS = { x: 100, y: 50 };
const POINTER_ID = TOUCH_PRESS_INIT.pointerId;

const FRAME_MS = 16; // `usePointerDrag` reports moves on the next animation frame.

const START_VALUE = { origin: "press" };
const NO_TRAVEL = { dx: 0, dy: 0 };

interface HandleProps {
  axis?: DragAxis | ((start: typeof START_VALUE) => DragAxis);
  threshold?: number;
  start?: () => typeof START_VALUE | null;
}

function Handle({ axis = "x", threshold, start = () => START_VALUE }: HandleProps) {
  return <div data-testid={HANDLE_ID} {...useAxisDrag({ axis, threshold, start, onBegin, onDragMove, onEnd })} />;
}

const renderHandle = (props: HandleProps = {}) => render(<Handle {...props} />);

function press(init: PointerEventInit = TOUCH_PRESS_INIT) {
  fireEvent.pointerDown(handle(), { ...init, clientX: PRESS.x, clientY: PRESS.y });
}

function dragBy({ dx = 0, dy = 0 }) {
  fireEvent.pointerMove(window, { buttons: 1, pointerId: POINTER_ID, clientX: PRESS.x + dx, clientY: PRESS.y + dy });
  advanceTimersBy(FRAME_MS);
}

const handle = () => screen.getByTestId(HANDLE_ID);

// Releases on the handle to match touch's implicit pointer capture.
const release = () => fireEvent.pointerUp(handle(), { pointerId: POINTER_ID, button: 0 });

const clickHandle = () => fireEvent.click(handle(), { detail: 1 });
const cancel = () => fireEvent.pointerCancel(window, { pointerId: POINTER_ID });

test("a mouse press begins the drag on its `pointerdown` event, with no travel", () => {
  renderHandle();
  press(MOUSE_PRESS_INIT);

  expect(onBegin).toHaveBeenCalledExactlyOnceWith(START_VALUE, NO_TRAVEL);
});

test("a mouse drag reports moves only once its travel exceeds `threshold`, while a touch press begins the drag before its travel reaches it", () => {
  const threshold = DRAG_THRESHOLD_PX + 10;

  renderHandle({ threshold });
  press(MOUSE_PRESS_INIT);
  dragBy({ dx: threshold });

  expect(onDragMove).not.toHaveBeenCalled();

  dragBy({ dx: threshold + 1 });

  expect(onDragMove).toHaveBeenCalledExactlyOnceWith({ dx: threshold + 1, dy: 0 }, START_VALUE);

  release();
  onBegin.mockClear();
  onDragMove.mockClear();

  press(TOUCH_PRESS_INIT);
  dragBy({ dx: DRAG_THRESHOLD_PX + 1 });

  expect(onBegin).toHaveBeenCalledExactlyOnceWith(START_VALUE, { dx: DRAG_THRESHOLD_PX + 1, dy: 0 });
});

test("a touch press begins the drag once its travel along the axis exceeds the drag threshold, reporting that travel at the beginning instead of as a move", () => {
  renderHandle();
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX }); // The travel must exceed the threshold, not merely reach it.

  expect(onBegin).not.toHaveBeenCalled();

  dragBy({ dx: DRAG_THRESHOLD_PX + 1 });

  expect(onBegin).toHaveBeenCalledExactlyOnceWith(START_VALUE, { dx: DRAG_THRESHOLD_PX + 1, dy: 0 });
  expect(onDragMove).not.toHaveBeenCalled();
});

test("a touch press does not begin a drag while its travel across the axis exceeds its travel along it, even past the drag threshold", () => {
  renderHandle();
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX + 2, dy: 20 });

  expect(onBegin).not.toHaveBeenCalled();
});

test("a touch press begins the drag along the axis that an `axis` function returns for the value from `start`", () => {
  const axis = vi.fn((): DragAxis => "y");

  renderHandle({ axis });
  press();
  dragBy({ dx: 20, dy: DRAG_THRESHOLD_PX + 2 });

  expect(axis).toHaveBeenCalledExactlyOnceWith(START_VALUE);
  expect(onBegin).not.toHaveBeenCalled();

  dragBy({ dx: DRAG_THRESHOLD_PX + 2, dy: 20 });

  expect(onBegin).toHaveBeenCalledExactlyOnceWith(START_VALUE, { dx: DRAG_THRESHOLD_PX + 2, dy: 20 });
});

test("a move after the drag begins reports its travel from the press point", () => {
  renderHandle();
  press();
  dragBy({ dx: 10 });
  dragBy({ dx: 20, dy: 30 });

  expect(onDragMove).toHaveBeenCalledExactlyOnceWith({ dx: 20, dy: 30 }, START_VALUE);
});

test("a tap's `click` event begins the drag with no travel, then ends it", () => {
  renderHandle();
  press();
  dragBy({ dx: DRAG_THRESHOLD_PX });
  release();

  expect(onBegin).not.toHaveBeenCalled();

  clickHandle();

  expect(onBegin).toHaveBeenCalledExactlyOnceWith(START_VALUE, NO_TRAVEL);
  expect(onEnd).toHaveBeenCalledExactlyOnceWith({ start: START_VALUE, isCanceled: false });
  expect(onBegin.mock.invocationCallOrder[0]).toBeLessThan(onEnd.mock.invocationCallOrder[0]!);
});

test("a tap followed by a `click` event outside the handle does not begin or end a drag", () => {
  // Happens after a long press or when iOS dispatches a tap's `click` event to a nearby control.
  renderHandle();
  press();
  release();
  fireEvent.click(document.body, { detail: 1 });

  expect(onBegin).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
});

test("a press elsewhere after a tap prevents a later `click` event on the handle from beginning a drag", () => {
  renderHandle();
  press();
  release();
  fireEvent.pointerDown(document.body, TOUCH_PRESS_INIT);
  clickHandle();

  expect(onBegin).not.toHaveBeenCalled();
});

test("a touch press canceled by the browser before the drag begins does not begin or end a drag", () => {
  renderHandle();
  press();
  dragBy({ dy: 20 });
  cancel();

  expect(onBegin).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
});

test("a touch press canceled by the browser after the drag begins ends the drag as canceled", () => {
  renderHandle();
  press();
  dragBy({ dx: 10 });
  cancel();

  expect(onEnd).toHaveBeenCalledExactlyOnceWith({ start: START_VALUE, isCanceled: true });
});

test("a press for which `start` returns `null` does not report a beginning, a move, or an end", () => {
  renderHandle({ start: () => null });
  press(MOUSE_PRESS_INIT);
  dragBy({ dx: 10 });
  release();

  expect(onBegin).not.toHaveBeenCalled();
  expect(onDragMove).not.toHaveBeenCalled();
  expect(onEnd).not.toHaveBeenCalled();
});
