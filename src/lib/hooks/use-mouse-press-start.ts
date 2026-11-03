import { useRef } from "react";

import { isSimulatedMouseDown } from "../press.ts";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

/**
 * Identifies the `mousedown` that begins a mouse press, for a control that responds to a mouse press on `mousedown` and
 * to a touch or pen press on `pointerdown`. The control calls `recordPointerDown` for the `pointerdown` of each press
 * it responds to, and `consumeMouseDown` for each `mousedown`.
 *
 * A touch press cannot wait for `mousedown`, which the browser dispatches only after a tap ends, and not at all after a
 * drag. The `mousedown` after a tap does not begin a mouse press, and neither do those of a screen reader's activate
 * action, which Chrome dispatches with a `detail` of `0` (see `isSimulatedMouseDown`) and Firefox dispatches without a
 * `pointerdown`.
 */
export function useMousePressStart() {
  const isMouseDownExpectedRef = useRef(false);
  return {
    /** Returns whether `event` belongs to a mouse press, whose `mousedown` the browser dispatches next. */
    recordPointerDown: (event: ReactPointerEvent | PointerEvent) => {
      isMouseDownExpectedRef.current = event.pointerType === "mouse";
      return isMouseDownExpectedRef.current;
    },
    /** Returns whether `event` begins a mouse press. */
    consumeMouseDown: (event: ReactMouseEvent | MouseEvent) => {
      const wasMouseDownExpected = isMouseDownExpectedRef.current;

      isMouseDownExpectedRef.current = false;

      return wasMouseDownExpected && !isSimulatedMouseDown(event);
    },
  };
}
