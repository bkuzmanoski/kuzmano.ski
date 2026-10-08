import { useRef } from "react";

import { isActivationKey } from "../keys.ts";
import { isPointerClick, isPrimaryPress } from "../press.ts";

import { playClickSound } from "./sounds.ts";

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";

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
 * `scrollSafe` defers touch presses until `click`, because a touch press in a scrollable region
 * may become a scroll and end with `pointercancel`, or may stop a scroll still in motion, which
 * ends with `pointerup` but no `click`. Mouse and pen presses play on `pointerdown`.
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
  const touchPressPendingRef = useRef(false); // Tracks a scroll-safe touch press until its `click` plays the sound.
  const keyPendingRef = useRef(false);

  return {
    onPointerDown: (event: PointerEvent) => {
      if (!isPrimaryPress(event)) {
        return;
      }

      if (scrollSafe && event.pointerType === "touch") {
        touchPressPendingRef.current = true;
        return;
      }

      pressPendingRef.current = true;

      // A touch whose `click` iOS retargeted to another control leaves its pending sound behind,
      // which would play a second time on this press's `click`.
      touchPressPendingRef.current = false;

      playClickSound();
    },
    onPointerCancel: () => {
      pressPendingRef.current = false;
      touchPressPendingRef.current = false;
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (isActivationKey(event.key) && !event.repeat) {
        keyPendingRef.current = true;
      }
    },
    onBlur: () => {
      keyPendingRef.current = false;
    },
    onClick: (event: MouseEvent) => {
      const isPointerActivation = isPointerClick(event);

      const isPressSoundDue = isPointerActivation
        ? touchPressPendingRef.current || (playOnClickWithoutPress && !pressPendingRef.current)
        : keyPendingRef.current;

      if (isPressSoundDue) {
        playClickSound();
      }

      pressPendingRef.current = false;
      touchPressPendingRef.current = false;
      keyPendingRef.current = false;
    },
  };
}
