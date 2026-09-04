import { useEffect, useRef } from "react";

import { playInputScroll, silenceScrollAt } from "./scroll.ts";

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
]); // Keys whose default action can move the caret out of view, scrolling the input.

/**
 * Plays a sound for user scrolling in an input without playing one for scrolling caused
 * by caret movement.
 *
 * A key moves the caret before the browser scrolls the input, so the handler marks keys
 * that may cause scrolling. The next scroll event consumes that mark and silences the
 * scroll sound until scrolling settles. If no scroll occurs, the mark is cleared on the
 * next frame.
 *
 * This is separate from `playInputScroll` because it correlates key and scroll events;
 * `playInputScroll` handles each scroll event independently.
 */
export function useInputScrollSound<T extends HTMLElement>() {
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

      playInputScroll(event.currentTarget);
    },
  };
}
