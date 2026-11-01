import { useEffect, useRef } from "react";

import { isPointerClick, isSimulatedMouseDown } from "../press.ts";

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

  useEffect(() => {
    function recordPointerPress() {
      isPointerPressRef.current = true;
    }

    function clearPointerPress() {
      isPointerPressRef.current = false;
    }

    function clearSimulatedPress(event: MouseEvent) {
      if (isSimulatedMouseDown(event)) {
        clearPointerPress();
      }
    }

    function clearClickWithoutPress(event: MouseEvent) {
      if (!isPointerClick(event)) {
        clearPointerPress();
      }
    }

    // Listens in the capture phase on the window, so the hook records the input before a control's handler acts on it,
    // and records a press on a control that stops its propagation.
    const controller = new AbortController();
    const options = { capture: true, signal: controller.signal };

    window.addEventListener("pointerdown", recordPointerPress, options);
    window.addEventListener("keydown", clearPointerPress, options);
    window.addEventListener("mousedown", clearSimulatedPress, options);
    window.addEventListener("click", clearClickWithoutPress, options);

    return () => controller.abort();
  }, []);

  return () => isPointerPressRef.current;
}
