import { useEffect, useRef, useState } from "react";

import { skipScrollAbove } from "../audio/scroll";
import { playHover } from "../audio/sounds";
import { isActivationKey } from "../keys";
import { clamp } from "../math";

import type { KeyboardEvent } from "react";

// Where each key moves the focus, from the item that received it.
const KEY_TARGETS: Record<string, ((index: number, lastIndex: number) => number) | undefined> = {
  ArrowUp: (index) => index - 1,
  ArrowDown: (index) => index + 1,
  Home: () => 0,
  End: (_index, lastIndex) => lastIndex,
};

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

    // `nearest` holds still while the item is already in view, so
    // activating one does not move the list under the pointer.
    item.scrollIntoView({ block: "nearest" });
    skipScrollAbove(item);
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

        item.focus();

        skipScrollAbove(item); // Focusing the item may scroll the window. That scroll is part of this keypress.
        playHover();
      },
    };
  };
}
