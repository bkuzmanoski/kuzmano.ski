import { useRef } from "react";

import { isPointerClick, isPrimaryPress } from "../press.ts";

import { playClick } from "./sounds.ts";

import type { MouseEvent, PointerEvent } from "react";

/**
 * Plays one sound for each press that reaches a control.
 *
 * The sound normally plays on `pointerdown`, so it coincides with the press. On iOS, a tap
 * near a small control can be retargeted to that control for the compatibility mouse events
 * and `click`, while the touch pointer events remain on the element under the finger. The
 * `click` must therefore play the sound when no `pointerdown` reached the control.
 *
 * The press remains recorded until `click`, rather than `pointerup`, so leaving and re-entering
 * the control does not play it twice.
 *
 * `scrollSafe` defers touch presses until `pointerup`, because a touch press in a scrollable
 * region may become a scroll and end with `pointercancel`. Mouse and pen presses play on
 * `pointerdown`.
 *
 * Disable `playOnClickWithoutPress` for controls inside UI that already handles the retargeted
 * tap. Otherwise the original target and this control can both play a sound for the same tap.
 *
 * A single instance can be shared by multiple controls; only one press is tracked at a time.
 */
export function usePressSound({
  scrollSafe = false,
  playOnClickWithoutPress = true,
}: { scrollSafe?: boolean; playOnClickWithoutPress?: boolean } = {}) {
  const pressPendingRef = useRef(false);

  return {
    onPointerDown: (event: PointerEvent) => {
      if (!isPrimaryPress(event)) {
        return;
      }

      pressPendingRef.current = true;

      if (!scrollSafe || event.pointerType !== "touch") {
        playClick();
      }
    },
    onPointerUp: (event: PointerEvent) => {
      if (scrollSafe && pressPendingRef.current && event.pointerType === "touch") {
        playClick();
      }
    },
    onPointerCancel: () => {
      pressPendingRef.current = false;
    },
    onClick: (event: MouseEvent) => {
      if (playOnClickWithoutPress && !pressPendingRef.current && isPointerClick(event)) {
        playClick();
      }

      pressPendingRef.current = false;
    },
  };
}
