import { useEffect, useRef, useState } from "react";

import { isActivationKey } from "../keys";
import { clamp } from "../math";

import type { KeyboardEvent } from "react";

/* Where each key moves the focus, from the item that received it. */
const KEY_TARGETS: Record<string, ((index: number, lastIndex: number) => number) | undefined> = {
  ArrowUp: (index) => index - 1,
  ArrowDown: (index) => index + 1,
  Home: () => 0,
  End: (_index, lastIndex) => lastIndex,
};

/**
 * Keyboard navigation for a vertical list. The list is a single tab stop, which lands on
 * the active item, and the arrow keys move the focus from there. Enter and space activate
 * the item that holds the focus.
 *
 * The active item is also scrolled into view as it changes, so a list that opens scrolled
 * to the top still shows what is selected.
 *
 * Spread the returned props onto each item, in the order the list draws them. An
 * `activeIndex` of -1 means nothing is active, and the tab stop falls on the first item.
 */
export function useListNavigation({
  count,
  activeIndex,
  onActivate,
}: {
  count: number;
  activeIndex: number;
  onActivate: (index: number) => void;
}) {
  const itemsRef = useRef<Array<HTMLElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  useEffect(() => {
    /* `nearest` holds still while the item is already in view, so activating one
     * does not move the list under the pointer. */
    itemsRef.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const tabStop = focusedIndex ?? Math.max(activeIndex, 0);

  return function itemProps(index: number) {
    return {
      ref: (element: HTMLElement | null) => {
        itemsRef.current[index] = element;
      },
      tabIndex: index === tabStop ? 0 : -1,
      onFocus: () => setFocusedIndex(index),
      onKeyDown: (event: KeyboardEvent) => {
        if (isActivationKey(event.key)) {
          /* Suppressed because space scrolls the viewport, and because the click the
           * browser makes of an Enter press would activate the item a second time. */
          event.preventDefault();
          onActivate(index);

          return;
        }

        const target = KEY_TARGETS[event.key]?.(index, count - 1);

        if (target === undefined) {
          return;
        }

        event.preventDefault();
        itemsRef.current[clamp(target, 0, count - 1)]?.focus();
      },
    };
  };
}
