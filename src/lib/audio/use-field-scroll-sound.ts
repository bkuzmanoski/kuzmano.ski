import { useEffect, useRef } from "react";

import { playFieldScroll, silenceScrollAt } from "./scroll";

import type { KeyboardEvent, UIEvent } from "react";

const CARET_SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]); // Keys whose default action can move the caret out of view, scrolling the field.

/**
 * Produces a sound for a field's own scrolling without playing a sound for caret movement.
 *
 * A key moves the caret before the browser scrolls the field, so the handler marks keys that
 * may cause scrolling. The next scroll event consumes that mark and silences the field until
 * scrolling settles. If no scroll occurs, the mark is cleared on the next frame.
 *
 * This is separate from `playFieldScroll` because it carries state between the key and scroll
 * events; `playFieldScroll` can handle each scroll event independently.
 */
export function useFieldScrollSound<T extends HTMLElement>() {
  const caretScrollRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      // A held key marks each repeat, so the mark outlives the last of them by a frame.
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  return {
    onKeyDown: (event: KeyboardEvent<T>) => {
      if (!CARET_SCROLL_KEYS.has(event.key)) {
        return;
      }

      caretScrollRef.current = true;

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        caretScrollRef.current = false;
      });
    },
    onScroll: (event: UIEvent<T>) => {
      if (caretScrollRef.current) {
        caretScrollRef.current = false;
        silenceScrollAt(event.currentTarget);
        return;
      }

      playFieldScroll(event.currentTarget);
    },
  };
}
