import { useRef } from "react";

import { useEventListeners } from "../hooks/use-event-listeners.ts";

import { isPointerClick, isSimulatedMouseDown } from "./press.ts";

/**
 * Returns a function that reports whether the latest input is a press with a pointing device, which means a
 * `pointerdown` without a later `keydown`, `mousedown` that `isSimulatedMouseDown` identifies, or `click` that
 * `isPointerClick` rejects.
 *
 * A screen reader's activate action does not count as a press. Chrome dispatches a `pointerdown` for it before the
 * simulated `mousedown`, and Safari and Firefox dispatch a `click` without a `pointerdown`.
 */
export function useIsFromPointerPress(): () => boolean {
  const isPointerPressRef = useRef(false);

  const recordPointerPress = () => {
    isPointerPressRef.current = true;
  };
  const clearPointerPress = () => {
    isPointerPressRef.current = false;
  };

  useEventListeners(
    "window",
    {
      pointerdown: recordPointerPress,
      keydown: clearPointerPress,
      mousedown: (event) => {
        if (isSimulatedMouseDown(event)) {
          clearPointerPress();
        }
      },
      click: (event) => {
        if (!isPointerClick(event)) {
          clearPointerPress();
        }
      },
    },
    { capture: true }, // Capture events on the window before control handlers run, including for controls that stop propagation.
  );

  return () => isPointerPressRef.current;
}
