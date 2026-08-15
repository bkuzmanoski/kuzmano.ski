import { useRef } from "react";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

/** The window within which a second press pairs with the first. */
export const DOUBLE_PRESS_INTERVAL = 350;

const SLOP = 16; // How far a press may travel, and how far the second may land from the first.

type DoublePressEvent = ReactPointerEvent | ReactMouseEvent;

const isBeyondSlop = (event: ReactPointerEvent, from: { x: number; y: number }) =>
  Math.abs(event.clientX - from.x) > SLOP || Math.abs(event.clientY - from.y) > SLOP;

/**
 * Detects a double press from mouse, touch, or pen input.
 *
 * Uses the native `dblclick` event for mouse input and pairs pointer
 * releases for touch and pen input, including browsers that do not
 * synthesise `dblclick` for double taps.
 *
 * Two presses must occur within `DOUBLE_PRESS_INTERVAL` and within
 * `SLOP` pixels of each other. A press that travels beyond `SLOP`
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

    const start = pressStartRef.current;

    pressStartRef.current = null;

    if (start && isBeyondSlop(event, start)) {
      pendingRef.current = null;
      return;
    }

    const pending = pendingRef.current;
    const currentTime = performance.now();

    if (pending && currentTime - pending.time <= DOUBLE_PRESS_INTERVAL && !isBeyondSlop(event, pending)) {
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
