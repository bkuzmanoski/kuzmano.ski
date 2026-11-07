import { useRef } from "react";

import { clientPositionOf, distanceBetween } from "../geometry.ts";

import { swallowNextPress } from "./press.ts";

import type { Position } from "../geometry.ts";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

/** The window within which a second press pairs with the first. */
export const DOUBLE_PRESS_INTERVAL_MS = 350;

/** How far a press may travel, and how far the second may land from the first. */
const DOUBLE_PRESS_TOLERANCE_PX = 16;

const exceedsTolerance = (event: ReactPointerEvent, from: Position) =>
  distanceBetween(clientPositionOf(event), from) > DOUBLE_PRESS_TOLERANCE_PX;

/**
 * Detects a double press from mouse, touch, or pen input.
 *
 * Uses the native `dblclick` event for mouse input and pairs pointer releases for touch and pen input, including
 * browsers that do not synthesize `dblclick` for double taps.
 *
 * Two presses form a double press when the second lands within `DOUBLE_PRESS_INTERVAL_MS` and
 * `DOUBLE_PRESS_TOLERANCE_PX` of the first. The hook treats a press that travels beyond `DOUBLE_PRESS_TOLERANCE_PX` as
 * a drag, which does not count toward a double press.
 *
 * `acceptsDoublePress` decides whether a double press calls `onDoublePress`. When it returns `true` for a touch or pen
 * double press, the hook also swallows the rest of the second press. When it returns `false` (e.g., for a second press
 * on a control inside the target), that press's `click` reaches the control.
 *
 * Drag handling beyond this gesture-level check remains the caller's responsibility.
 */
export function useDoublePress({
  acceptsDoublePress,
  onDoublePress,
}: {
  acceptsDoublePress: (event: ReactPointerEvent | ReactMouseEvent) => boolean;
  onDoublePress: () => void;
}) {
  const lastPointerTypeRef = useRef("mouse");
  const pressStartRef = useRef<Position | null>(null);
  const pendingPressRef = useRef<(Position & { time: number }) | null>(null);

  function onPointerDown(event: ReactPointerEvent) {
    if (event.pointerType !== "mouse") {
      pressStartRef.current = clientPositionOf(event);
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
      pendingPressRef.current = null;
      return;
    }

    const pendingPress = pendingPressRef.current;
    const currentTime = performance.now();

    if (
      pendingPress &&
      currentTime - pendingPress.time <= DOUBLE_PRESS_INTERVAL_MS &&
      !exceedsTolerance(event, pendingPress)
    ) {
      pendingPressRef.current = null;

      if (acceptsDoublePress(event)) {
        onDoublePress();

        // The browser dispatches this press's `click` and `dblclick` after `pointerup`, potentially targeting content
        // moved or opened by `onDoublePress`. This hook swallows them after calling `onDoublePress`, so the clicks
        // dispatched by the callback run.
        swallowNextPress();
      }

      return;
    }

    pendingPressRef.current = { ...clientPositionOf(event), time: currentTime };
  }

  function onPointerCancel() {
    pressStartRef.current = null;
    pendingPressRef.current = null;
  }

  function onDoubleClick(event: ReactMouseEvent) {
    if (lastPointerTypeRef.current === "mouse" && acceptsDoublePress(event)) {
      onDoublePress();
    }
  }

  return { onPointerDown, onPointerUp, onPointerCancel, onDoubleClick };
}
