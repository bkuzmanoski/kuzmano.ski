import { useEffect, useRef } from "react";

import { MAX_CLICK_DELAY_MS } from "../press.ts";

/**
 * Returns a function that reports whether the current action follows a pointer press (a
 * `pointerdown` less than `MAX_CLICK_DELAY_MS` ago, with no `keydown` since).
 *
 * The time limit is for an assistive technology, which activates a control with a `click`
 * that neither a `pointerdown` nor a `keydown` precedes. Without it, a `pointerdown` any
 * length of time before that `click` would count.
 */
export function useFollowsPointerPress(): () => boolean {
  const pointerPressTimeRef = useRef<number | null>(null);

  useEffect(() => {
    function recordPointerPress() {
      pointerPressTimeRef.current = performance.now();
    }

    function clearPointerPress() {
      pointerPressTimeRef.current = null;
    }

    // Captured on the window, so a control that stops the propagation of a press is still recorded.
    window.addEventListener("pointerdown", recordPointerPress, true);
    window.addEventListener("keydown", clearPointerPress, true);

    return () => {
      window.removeEventListener("pointerdown", recordPointerPress, true);
      window.removeEventListener("keydown", clearPointerPress, true);
    };
  }, []);

  return () => {
    const pointerPressTime = pointerPressTimeRef.current;
    return pointerPressTime !== null && performance.now() - pointerPressTime < MAX_CLICK_DELAY_MS;
  };
}
