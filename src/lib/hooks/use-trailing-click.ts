import { useRef } from "react";

import { isPointerClick, isPrimaryPress } from "../press.ts";

import type { MouseEvent, PointerEvent } from "react";

/**
 * Detects the `click` that ends a press a control acted on when the press began, preventing the control from acting
 * twice. The control calls `recordPress` for each press it acts on, passes its `pointerup` events to `onPointerUp`, and
 * calls `consume` from its `click` handler.
 *
 * The browser dispatches a `click` for a press only when the press ends on the element it started on. Any other `click`
 * comes from the keyboard, assistive technology, or iOS retargeting a nearby tap's compatibility `click` to the
 * control.
 *
 * Clears a recorded press at the next `pointerdown`, as a press can end without its `click` (e.g., a touch that slides
 * off the control). The hook would otherwise take the `click` of a later tap that iOS retargets to the control for the
 * end of that press. A retargeted tap still dispatches its `pointerdown`, on the element under the finger.
 */
export function useTrailingClick() {
  const isPressedRef = useRef(false);
  const isTrailingClickExpectedRef = useRef(false);

  function clearPress() {
    isPressedRef.current = false;
    isTrailingClickExpectedRef.current = false;
  }

  return {
    recordPress: () => {
      isPressedRef.current = true;
      window.addEventListener("pointerdown", clearPress, { capture: true, once: true }); // Removes itself at the next press, so the hook does not need an effect to remove it after the control unmounts.
    },
    onPointerUp: (event: PointerEvent) => {
      isTrailingClickExpectedRef.current = isPrimaryPress(event) && isPressedRef.current;
      isPressedRef.current = false;
    },
    /**
     * Returns whether `event` ends a recorded press. Returns `false` for a `click` that `isPointerClick` rejects, as a
     * key press and the activate action in Safari and Firefox do not dispatch the `pointerdown` that clears a press
     * without a `click`.
     */
    consume: (event: MouseEvent) => {
      const wasTrailingClickExpected = isTrailingClickExpectedRef.current;

      isTrailingClickExpectedRef.current = false;

      return wasTrailingClickExpected && isPointerClick(event);
    },
  };
}
