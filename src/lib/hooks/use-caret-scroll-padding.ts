import { useEffect, useRef } from "react";

import { isCaretScrollKey } from "../keys.ts";

import type { KeyboardEvent, UIEvent } from "react";

/**
 * Ensures caret-driven scrolling reveals an input's vertical padding.
 *
 * Spread these handlers before caller handlers so they observe the adjusted scroll position.
 */
export function useCaretScrollPadding<T extends HTMLElement>() {
  const caretScrollRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const previousTopRef = useRef(0);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  function markCaretScroll() {
    caretScrollRef.current = true;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      caretScrollRef.current = false;
    });
  }

  return {
    onInput: markCaretScroll,
    onKeyDown: (event: KeyboardEvent<T>) => {
      if (isCaretScrollKey(event.key)) {
        markCaretScroll();
      }
    },
    onScroll: (event: UIEvent<T>) => {
      const element = event.currentTarget;
      const top = element.scrollTop;
      const previousTop = previousTopRef.current;

      previousTopRef.current = top;

      if (!caretScrollRef.current) {
        return;
      }

      caretScrollRef.current = false;

      const style = getComputedStyle(element);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize);
      const paddingTop = parseFloat(style.paddingTop);
      const paddingBottom = parseFloat(style.paddingBottom);
      const maxTop = element.scrollHeight - element.clientHeight;

      // Because the caret is shorter than its line, the first and last lines need an extra line of space beyond the
      // padding. Snap to the relevant edge when that space is absent. Use `scrollHeight` so the browser clamps to
      // its unrounded maximum instead of `maxTop`.
      if (top > previousTop) {
        element.scrollTop = maxTop - top < paddingBottom + lineHeight ? element.scrollHeight : top + paddingBottom;
      } else if (top < previousTop && top < maxTop) {
        element.scrollTop = top < paddingTop + lineHeight ? 0 : top - paddingTop;
      }

      previousTopRef.current = element.scrollTop;
    },
  };
}
