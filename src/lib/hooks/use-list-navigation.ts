import { useEffect, useRef, useState } from "react";

import { scrollIntoViewSilently } from "../audio/scroll";
import { playHover } from "../audio/sounds";
import { isActivationKey } from "../keys";
import { clamp } from "../math";

import type { KeyboardEvent, MouseEvent } from "react";

// Where each key moves the focus, from the item that received it.
const KEY_TARGETS: Record<string, ((index: number, lastIndex: number) => number) | undefined> = {
  ArrowUp: (index) => index - 1,
  ArrowDown: (index) => index + 1,
  Home: () => 0,
  End: (_index, lastIndex) => lastIndex,
};

// `preventScroll` overrides the browser's focus-scroll which can stop short of
// bringing an element fully into view and sounds a scroll detent.
function focusItem(item: HTMLElement) {
  item.focus({ preventScroll: true });
  scrollIntoViewSilently(item);
}

/** Keyboard navigation for a vertical list. */
export function useListNavigation({
  count,
  activeIndex,
  onActivate,
}: {
  count: number;
  activeIndex: number;
  onActivate: (index: number) => void;
}) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const itemsRef = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const item = itemsRef.current[activeIndex];

    if (!item) {
      return;
    }

    scrollIntoViewSilently(item);
  }, [activeIndex]);

  const tabStop = clamp(focusedIndex ?? Math.max(activeIndex, 0), 0, count - 1);

  return function itemProps(index: number) {
    return {
      ref: (element: HTMLElement | null) => {
        itemsRef.current[index] = element;
      },
      tabIndex: index === tabStop ? 0 : -1,
      onFocus: () => setFocusedIndex(index),
      onMouseDown: (event: MouseEvent<HTMLElement>) => {
        // A handler merged ahead of this one (see `mergeHandlers`) may prevent the default
        // to opt a press out of this hook's own handling, e.g. one the browser should
        // keep, such as a link opened in a new tab.
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault(); // Suppress the native focus so `focusItem` can place it without the browser's scroll.
        focusItem(event.currentTarget);
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (isActivationKey(event.key)) {
          event.preventDefault(); // Prevent the browser's default scroll and click behaviour so activation happens only once.
          onActivate(index);

          return;
        }

        const target = KEY_TARGETS[event.key]?.(index, count - 1);

        if (target === undefined) {
          return;
        }

        event.preventDefault();

        const next = clamp(target, 0, count - 1);
        const item = itemsRef.current[next];

        if (next === index || !item) {
          return; // Nothing moves at either end of the list, so there is no travel to report.
        }

        focusItem(item);
        playHover();
      },
    };
  };
}
