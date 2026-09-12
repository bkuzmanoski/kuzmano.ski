import { useRef } from "react";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

/** The window within which a second press pairs with the first. */
export const DOUBLE_PRESS_INTERVAL_MS = 350;

const TOLERANCE_PX = 16; // How far a press may travel, and how far the second may land from the first.

type DoublePressEvent = ReactPointerEvent | ReactMouseEvent;

const exceedsTolerance = (event: ReactPointerEvent, from: { x: number; y: number }) =>
  Math.abs(event.clientX - from.x) > TOLERANCE_PX || Math.abs(event.clientY - from.y) > TOLERANCE_PX;

/**
 * Detects a double press from mouse, touch, or pen input.
 *
 * Uses the native `dblclick` event for mouse input and pairs pointer
 * releases for touch and pen input, including browsers that do not
 * synthesise `dblclick` for double taps.
 *
 * Two presses must occur within `DOUBLE_PRESS_INTERVAL` and within
 * `TOLERANCE` pixels of each other. A press that travels beyond `TOLERANCE`
 * is treated as a drag and cannot participate in a double press.
 *
 * Drag handling beyond this gesture-level check remains the caller's
 * responsibility.
 */
export function useDoublePress({ onDoublePress }: { onDoublePress: (event: DoublePressEvent) => void }) {
  const lastPointerTypeRef = useRef("mouse");
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const pendingRef = useRef<{ time: number; x: number; y: number } | null>(null);

  function onPointerDown(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") {
      pressStartRef.current = { x: event.clientX, y: event.clientY };
    }
  }

  function onPointerUp(event: ReactPointerEvent) {
    lastPointerTypeRef.current = event.pointerType;

    if (event.pointerType === "mouse") {
      return;
    }

    const pressStart = pressStartRef.current;

    pressStartRef.current = null;

    if (pressStart && exceedsTolerance(event, pressStart)) {
      pendingRef.current = null;
      return;
    }

    const pendingPress = pendingRef.current;
    const currentTime = performance.now();

    if (
      pendingPress &&
      currentTime - pendingPress.time <= DOUBLE_PRESS_INTERVAL_MS &&
      !exceedsTolerance(event, pendingPress)
    ) {
      pendingRef.current = null;
      onDoublePress(event);

      return;
    }

    pendingRef.current = { time: currentTime, x: event.clientX, y: event.clientY };
  }

  function onPointerCancel() {
    pressStartRef.current = null;
    pendingRef.current = null;
  }

  function onDoubleClick(event: ReactMouseEvent) {
    if (lastPointerTypeRef.current === "mouse") {
      onDoublePress(event);
    }
  }

  return { onPointerDown, onPointerUp, onPointerCancel, onDoubleClick };
}
