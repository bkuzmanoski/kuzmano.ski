import { useEffect, useRef } from "react";

import { playFieldScroll, skipScrollAt } from "./scroll";

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
 * Sounds a field's own scrolling, without sounding the scroll a caret movement causes.
 *
 * The field scrolls to keep the caret in view only once the key's default action runs,
 * which happens after this handler returns, so a caret-moving key only marks the scroll
 * that may follow. The mark is claimed by the next scroll event, or otherwise cleared on
 * the next frame once it is clear the key moved nothing.
 *
 * This lives apart from `playFieldScroll` because it holds state between two events; the
 * pane's scrolling reads everything it needs from the one event and stays a function.
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
        skipScrollAt(event.currentTarget);
        return;
      }

      playFieldScroll(event.currentTarget);
    },
  };
}
