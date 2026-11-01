import { useRef } from "react";

import { useMousePressStart } from "../hooks/use-mouse-press-start.ts";
import { isActivationKey } from "../keys.ts";
import { isBrowserHandledClick } from "../link.ts";
import { isPointerClick, isPrimaryPress } from "../press.ts";

import { playClickSound } from "./sounds.ts";

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";

interface PressSoundOptions {
  /**
   * Defers the sound of a touch press until its `click`. In a scrollable region, a touch press may become a scroll,
   * which ends with `pointercancel`, or stop a scroll in motion, which ends with `pointerup` but no `click`.
   */
  defersTouchPressSound?: boolean;
  /**
   * Plays the sound for a `click` without a `pointerdown` on the control. A control inside UI that already plays the
   * sound of a retargeted tap sets it to `false`, so the tap does not play the sound twice.
   */
  playsOnClickWithoutPress?: boolean;
  /** Does not play the sound for a press or `click` that `isBrowserHandledClick` identifies. */
  silencesBrowserHandledPress?: boolean;
}

/**
 * Plays the click sound once for each press on a control.
 *
 * Plays the sound of a touch or pen press on `pointerdown`, so it coincides with the press. Plays the sound of a mouse
 * press on the `mousedown` the browser dispatches with `pointerdown`, as only that `mousedown` separates the press from
 * a screen reader's activate action in Chrome (see `isSimulatedMouseDown`). A touch press cannot wait for `mousedown`,
 * which the browser dispatches only after a tap ends, and not at all after a drag.
 *
 * Plays the sound on `click` for a key press, and for a `click` without a `pointerdown` on the control. A tap near a
 * small control on iOS can produce such a `click`, because the browser can retarget the tap's compatibility mouse
 * events and `click` to the control while its touch pointer events stay on the element under the finger.
 *
 * Does not play the sound for a screen reader's activate action, as a screen reader provides its own feedback.
 *
 * The hook records a press until its `click`, rather than `pointerup`, so leaving and re-entering the control does not
 * play the sound twice. Multiple controls can share an instance, which tracks one press at a time.
 */
export function usePressSoundPlayer({
  defersTouchPressSound = false,
  playsOnClickWithoutPress = true,
  silencesBrowserHandledPress = false,
}: PressSoundOptions = {}) {
  const isPressPendingRef = useRef(false);
  const isTouchPressPendingRef = useRef(false); // Tracks a deferred touch press until its `click` plays the sound.
  const isKeyPendingRef = useRef(false);
  const mousePressStart = useMousePressStart();

  const isSilentPress = (event: MouseEvent) => silencesBrowserHandledPress && isBrowserHandledClick(event);

  return {
    handlers: {
      onPointerDown: (event: PointerEvent) => {
        if (!isPrimaryPress(event) || event.currentTarget.matches(":disabled") || isSilentPress(event)) {
          return;
        }

        const isMousePress = mousePressStart.recordPointerDown(event);

        if (defersTouchPressSound && event.pointerType === "touch") {
          isTouchPressPendingRef.current = true;
          return;
        }

        isPressPendingRef.current = true;

        // A touch whose `click` iOS retargeted to another control leaves its pending sound behind, which would play a
        // second time on this press's `click`.
        isTouchPressPendingRef.current = false;

        if (!isMousePress) {
          playClickSound();
        }
      },
      onMouseDown: (event: MouseEvent) => {
        if (mousePressStart.consumeMouseDown(event)) {
          playClickSound();
        }
      },
      onPointerCancel: () => {
        isPressPendingRef.current = false;
        isTouchPressPendingRef.current = false;
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (isActivationKey(event.key) && !event.repeat) {
          isKeyPendingRef.current = true;
        }
      },
      onBlur: () => {
        isKeyPendingRef.current = false;
      },
      onClick: (event: MouseEvent) => {
        const shouldPlayPressSound =
          !isSilentPress(event) &&
          (isPointerClick(event)
            ? isTouchPressPendingRef.current || (playsOnClickWithoutPress && !isPressPendingRef.current)
            : isKeyPendingRef.current);

        if (shouldPlayPressSound) {
          playClickSound();
        }

        isPressPendingRef.current = false;
        isTouchPressPendingRef.current = false;
        isKeyPendingRef.current = false;
      },
    },
    /**
     * Plays the sound of a deferred touch press whose `click` will not arrive (e.g., the second tap of a double tap,
     * which `useDoublePress` swallows).
     */
    playPendingTouchPressSound: () => {
      if (isTouchPressPendingRef.current) {
        isTouchPressPendingRef.current = false;
        playClickSound();
      }
    },
  };
}

/**
 * Returns the event handlers of `usePressSoundPlayer`, for a control that does not call `playPendingTouchPressSound`.
 */
export function usePressSound(options?: PressSoundOptions) {
  return usePressSoundPlayer(options).handlers;
}
