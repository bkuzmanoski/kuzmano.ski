import { useRef } from "react";

import { playClickSound } from "../audio/sounds.ts";
import { isActivationKey } from "../keys.ts";
import { isBrowserHandledClick } from "../link.ts";

import { isPointerClick, isPrimaryPress } from "./press.ts";
import { useMousePressStart } from "./use-mouse-press-start.ts";

import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";

interface PressSoundOptions {
  defersTouchPressSound?: boolean;
  playsOnClickWithoutPress?: boolean;
  silencesBrowserHandledPress?: boolean;
  onPressStart?: (event: MouseEvent) => void;
}

/**
 * Plays one click sound for each control press.
 *
 * Touch and pen presses play on `pointerdown` to align the sound with the press. Mouse presses play on the `mousedown`
 * dispatched with `pointerdown`, because in Chrome this distinguishes them from screen-reader activation (see
 * `isSimulatedMouseDown`). Touch presses cannot wait for `mousedown`, which fires only after a tap ends and not after a
 * drag.
 *
 * Key presses, and clicks without a preceding `pointerdown` on the control, play on `click`. The latter can occur on
 * iOS when a tap near a small control retargets compatibility mouse events and `click`, while touch pointer events
 * remain on the element under the finger.
 *
 * Screen-reader activation does not play a sound because the screen reader provides feedback.
 *
 * A press remains recorded until its `click`, rather than `pointerup`, preventing duplicate sounds when a pointer
 * leaves and re-enters the control. One instance may be shared by multiple controls and tracks one press at a time.
 */
export function usePressSoundPlayer({
  defersTouchPressSound = false,
  playsOnClickWithoutPress = true,
  silencesBrowserHandledPress = false,
  onPressStart,
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
          onPressStart?.(event);
          return;
        }

        isPressPendingRef.current = true;

        // A touch whose `click` iOS retargeted to another control leaves its pending sound behind, which would play a
        // second time on this press's `click`.
        isTouchPressPendingRef.current = false;

        if (!isMousePress) {
          playClickSound();
          onPressStart?.(event);
        }
      },
      onMouseDown: (event: MouseEvent) => {
        if (mousePressStart.consumeMouseDown(event)) {
          playClickSound();
          onPressStart?.(event);
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

/** Returns `usePressSoundPlayer` handlers for controls that do not defer pending touch press sounds. */
export function usePressSound(options?: PressSoundOptions) {
  return usePressSoundPlayer(options).handlers;
}
