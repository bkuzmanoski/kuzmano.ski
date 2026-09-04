import { useEffect, useId, useState } from "react";

import { scrollIntoViewSilently } from "../audio/scroll.ts";
import { playHover } from "../audio/sounds.ts";
import { isActivationKey } from "../keys.ts";
import { clamp } from "../math.ts";

import type { KeyboardEvent, MouseEvent, RefObject } from "react";

// Marks an item as belonging to one list, by that list's own id. Spread from `itemProps`
// rather than set by the caller, so an item cannot be navigable but unreachable. The id
// prevents a list from claiming the items of another nested inside it: a container search
// reaches the whole subtree, so the mark has to identify which list the item belongs to.
const ITEM_ATTRIBUTE = "data-list-item";

// Where each key moves the focus, from the item that received it.
const KEY_TARGETS: Record<string, ((index: number, lastIndex: number) => number) | undefined> = {
  ArrowUp: (index) => index - 1,
  ArrowDown: (index) => index + 1,
  Home: () => 0,
  End: (_index, lastIndex) => lastIndex,
};

function itemAt(list: HTMLElement | null, listId: string, index: number) {
  const items = list?.querySelectorAll<HTMLElement>(`[${ITEM_ATTRIBUTE}]`) ?? [];

  let found = -1;

  // The id is compared rather than selected on: `useId` values are
  // opaque so this lookup must not assume they are selector-safe.
  for (const item of items) {
    if (item.getAttribute(ITEM_ATTRIBUTE) === listId && ++found === index) {
      return item;
    }
  }

  return null;
}

function focusItem(item: HTMLElement) {
  item.focus({ preventScroll: true });
  scrollIntoViewSilently(item);
}

/**
 * Keyboard navigation for a vertical list.
 *
 * The items are read back from `listRef` rather than collected as they mount: the DOM
 * already holds them, in order, for exactly as long as they are rendered. A registry of
 * its own would have to be filled by a ref on every item, emptied as items unmount, and
 * kept from being read past its end once the list shrinks.
 */
export function useListNavigation(
  listRef: RefObject<HTMLElement | null>,
  {
    count,
    activeIndex,
    onActivate,
  }: {
    count: number;
    activeIndex: number;
    onActivate: (index: number) => void;
  },
) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const listId = useId();

  useEffect(() => {
    const item = itemAt(listRef.current, listId, activeIndex);

    if (!item) {
      return;
    }

    scrollIntoViewSilently(item);
  }, [listRef, listId, activeIndex]);

  const tabStop = clamp(focusedIndex ?? Math.max(activeIndex, 0), 0, count - 1);

  return function itemProps(index: number) {
    return {
      [ITEM_ATTRIBUTE]: listId,
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
        const item = itemAt(listRef.current, listId, next);

        if (next === index || !item) {
          return; // The focus stays put at either end of the list, so there is no travel to report.
        }

        focusItem(item);
        playHover();
      },
    };
  };
}
