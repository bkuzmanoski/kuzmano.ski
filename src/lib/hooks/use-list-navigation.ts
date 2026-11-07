import { useEffect, useId, useState } from "react";

import { scrollIntoViewSilently } from "../audio/scroll.ts";
import { playHoverSound } from "../audio/sounds.ts";
import { activateOnKeyPress } from "../keys.ts";
import { navigationTargetOf } from "../list-navigation.ts";
import { clamp } from "../math.ts";

import type { KeyboardEvent, MouseEvent, RefObject } from "react";

/**
 * Marks an item as belonging to one list, by that list's own ID. Spread from `itemProps` rather than set by the caller,
 * so an item cannot be navigable but unreachable. The id prevents a list from claiming the items of another nested
 * inside it: a container search reaches the whole subtree, so the mark has to identify which list the item belongs to.
 */
const ITEM_ATTRIBUTE = "data-list-item";

const NAVIGATION_OPTIONS = { wraps: false };

function itemAt(list: HTMLElement | null, listId: string, index: number) {
  const items = list?.querySelectorAll<HTMLElement>(`[${ITEM_ATTRIBUTE}]`) ?? [];

  let matchedIndex = -1;

  // The id is compared rather than selected on: `useId` values are opaque so this lookup must not assume they are
  // selector-safe.
  for (const item of items) {
    if (item.getAttribute(ITEM_ATTRIBUTE) === listId && ++matchedIndex === index) {
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
 * The items are read back from `listRef` rather than collected as they mount: the DOM already holds them, in order, for
 * exactly as long as they are rendered. A registry of its own would have to be filled by a ref on every item, emptied
 * as items unmount, and kept from being read past its end once the list shrinks.
 */
export function useListNavigation(
  listRef: RefObject<HTMLElement | null>,
  {
    count,
    currentIndex,
    onActivate,
  }: {
    count: number;
    currentIndex: number;
    onActivate: (index: number) => void;
  },
) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const listId = useId();

  useEffect(() => {
    const item = itemAt(listRef.current, listId, currentIndex);

    if (!item) {
      return;
    }

    scrollIntoViewSilently(item);
  }, [listRef, listId, currentIndex]);

  const tabStopIndex = clamp(focusedIndex ?? Math.max(currentIndex, 0), 0, count - 1);

  function itemProps(index: number) {
    return {
      [ITEM_ATTRIBUTE]: listId,
      tabIndex: index === tabStopIndex ? 0 : -1,
      onFocus: () => setFocusedIndex(index),
      onMouseDown: (event: MouseEvent<HTMLElement>) => {
        // A handler merged ahead of this one (see `mergeHandlers`) may prevent the default to opt a press out of this
        // hook's own handling (e.g., a press that opens a link in a new tab).
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault(); // Suppress the native focus so `focusItem` can place it without the browser's scroll.
        focusItem(event.currentTarget);
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (activateOnKeyPress(event, () => onActivate(index))) {
          return;
        }

        const nextIndex = navigationTargetOf(event.key, index, count, NAVIGATION_OPTIONS);

        if (nextIndex === null) {
          return;
        }

        event.preventDefault();

        const item = itemAt(listRef.current, listId, nextIndex);

        if (nextIndex === index || !item) {
          return; // The focus stays put at either end of the list, so there is no travel to report.
        }

        focusItem(item);
        playHoverSound();
      },
    };
  }

  // Handles arrow keys pressed outside the list, such as on its containing window, by moving focus into the list. Each
  // key focuses the item at the end it points toward, matching a combobox opening its popup. Prevents the default only
  // when focus moves.
  function onKeyDownOutsideList(event: KeyboardEvent) {
    const targetIndex = navigationTargetOf(event.key, -1, count, NAVIGATION_OPTIONS);
    const item = targetIndex === null ? null : itemAt(listRef.current, listId, targetIndex);

    if (!item) {
      return;
    }

    event.preventDefault();
    focusItem(item);
    playHoverSound();
  }

  return { itemProps, onKeyDownOutsideList };
}
