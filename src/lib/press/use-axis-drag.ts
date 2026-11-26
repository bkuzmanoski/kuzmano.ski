import { useRef } from "react";

import { DRAG_THRESHOLD_PX, usePointerDrag } from "./use-pointer-drag.ts";
import { useTrailingClick } from "./use-trailing-click.ts";

import type { DragDelta, DragEnd } from "./use-pointer-drag.ts";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

/** The axis along which a drag reads the pointer's travel. */
export type DragAxis = "x" | "y";

interface AxisPress<T> {
  value: T;
  axis: DragAxis;
  hasBegun: boolean;
  hasPassedThreshold: boolean;
}

const NO_TRAVEL: DragDelta = { dx: 0, dy: 0 };

/** Whether travel along `axis` exceeds the drag threshold and cross-axis travel. */
function isTravelAlong(axis: DragAxis, { dx, dy }: DragDelta) {
  const travelAlongPx = Math.abs(axis === "x" ? dx : dy);
  const travelAcrossPx = Math.abs(axis === "x" ? dy : dx);

  return travelAlongPx > DRAG_THRESHOLD_PX && travelAlongPx > travelAcrossPx;
}

/**
 * Wraps `usePointerDrag` for a single-axis handle. Use `touch-action` (for example, `pan-y`) to let the browser handle
 * cross-axis gestures such as scrolling.
 *
 * Mouse and pen presses begin immediately. Touch presses defer `onBegin` and its side effects until travel along the
 * axis exceeds both `DRAG_THRESHOLD_PX` and cross-axis travel, or until a tap's `click`. Waiting for `click` avoids
 * beginning taps retargeted by iOS or Chrome long presses that produce no click. A second touch cancels the drag to
 * allow pinch-zooming.
 *
 * Return `null` from `start` to ignore a press. `axis` may be derived from the value returned by `start`.
 */
export function useAxisDrag<T>({
  axis,
  threshold = 0,
  preventDefault,
  canStart,
  start,
  onBegin,
  onDragMove,
  onEnd,
}: {
  axis: DragAxis | ((start: T) => DragAxis);
  /** Minimum travel before mouse or pen drag moves are reported. */
  threshold?: number;
  preventDefault?: boolean;
  canStart?: (event: ReactPointerEvent) => boolean;
  start: (event: ReactPointerEvent) => T | null;
  onBegin: (start: T, delta: DragDelta) => void;
  onDragMove: (delta: DragDelta, start: T) => void;
  onEnd?: (end: DragEnd<T>) => void;
}) {
  const trailingClick = useTrailingClick();
  const tapRef = useRef<AxisPress<T> | null>(null); // A touch that ended before beginning, pending its click.

  function begin(press: AxisPress<T>, delta: DragDelta) {
    press.hasBegun = true;
    onBegin(press.value, delta);
  }

  const pointerDragHandlers = usePointerDrag<AxisPress<T>>({
    preventDefault,
    endsOnSecondTouch: true,
    canStart,
    start: (event) => {
      tapRef.current = null;

      const value = start(event);

      if (value === null) {
        return null;
      }

      const isTouch = event.pointerType === "touch";
      const press: AxisPress<T> = {
        value,
        axis: typeof axis === "function" ? axis(value) : axis,
        hasBegun: false,
        hasPassedThreshold: isTouch || threshold <= 0,
      };

      if (isTouch) {
        trailingClick.recordPress();
      } else {
        begin(press, NO_TRAVEL);
      }

      return press;
    },
    onDragMove: (delta, press) => {
      if (press.hasBegun) {
        if (!press.hasPassedThreshold) {
          if (Math.hypot(delta.dx, delta.dy) <= threshold) {
            return;
          }

          press.hasPassedThreshold = true;
        }

        onDragMove(delta, press.value);
      } else if (isTravelAlong(press.axis, delta)) {
        begin(press, delta);
      }
    },
    onEnd: (_moved, { start: press, isCanceled }) => {
      if (press.hasBegun) {
        onEnd?.({ start: press.value, isCanceled });
      } else if (!isCanceled) {
        tapRef.current = press;
      }
    },
  });

  return {
    ...pointerDragHandlers,
    onPointerUp: trailingClick.onPointerUp,
    onClick: (event: ReactMouseEvent) => {
      const tap = tapRef.current;
      const isTapClick = trailingClick.consume(event);

      tapRef.current = null;

      if (tap && isTapClick) {
        begin(tap, NO_TRAVEL);
        onEnd?.({ start: tap.value, isCanceled: false });
      }
    },
  };
}
