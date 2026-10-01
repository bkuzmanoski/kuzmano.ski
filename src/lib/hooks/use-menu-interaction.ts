import { useEffect, useEffectEvent, useRef, useState } from "react";

import { playClickSound, playHoverSound } from "../audio/sounds.ts";
import { cycle } from "../math.ts";
import { isPointerClick, isPrimaryPress } from "../press.ts";

import { useActivationFlash } from "./use-activation-flash.ts";
import { DRAG_THRESHOLD_PX } from "./use-pointer-drag.ts";
import { useTimer } from "./use-timer.ts";

import type { Position } from "../geometry.ts";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";

const TYPEAHEAD_RESET_MS = 500;

export interface MenuInteractionItem {
  label: string;
  isEnabled: boolean;
}

// The index of the item under a point, or -1 if the point is not over one. The point is hit-tested
// rather than read from an event's target, because on iOS a tap near an item can be retargeted to it
// for the compatibility mouse events and `click`, while the touch pointer events remain on the element
// under the finger.
function indexAt(x: number, y: number): number {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-index]");
  return element ? Number(element.dataset.index) : -1;
}

function lastEnabledIndex(items: ReadonlyArray<MenuInteractionItem>): number {
  for (let index = items.length - 1; index >= 0; index--) {
    if (items[index]?.isEnabled) {
      return index;
    }
  }

  return -1;
}

export function useMenuInteraction({
  items,
  anchor,
  listRef,
  isPointerHeld,
  pressOrigin,
  initialFocusedItemIndex,
  isBrowserHandledRelease,
  onActivate,
  onClose,
}: {
  items: ReadonlyArray<MenuInteractionItem>;
  anchor: HTMLElement | null;
  listRef: RefObject<HTMLElement | null>;
  isPointerHeld: boolean;
  pressOrigin: Position | null; // `null` when the press that opened the menu was not at a known point, which treats any release as having moved.
  initialFocusedItemIndex: number; // `-1` if no item should have focus when the menu is first opened.
  isBrowserHandledRelease?: (index: number, event: PointerEvent) => boolean; // Whether the browser handles a release on the item, preventing menu activation.
  onActivate: (index: number) => void;
  onClose: () => void;
}) {
  const flash = useActivationFlash<number>();
  const typeaheadTimer = useTimer();
  const [focusedItemIndex, setFocusedItemIndex] = useState(initialFocusedItemIndex);
  const isStickyRef = useRef(!isPointerHeld);
  const isOpeningPressStationaryRef = useRef(pressOrigin !== null); // True until the opening press crosses the drag threshold or a new press begins.
  const focusedItemIndexRef = useRef(focusedItemIndex);
  const typeaheadRef = useRef("");

  function focusItem(index: number) {
    if (index === focusedItemIndexRef.current) {
      return;
    }

    focusedItemIndexRef.current = index;

    setFocusedItemIndex(index);

    if (index >= 0) {
      playHoverSound();
    }
  }

  function focusEdgeItem(edge: "first" | "last") {
    const index = edge === "first" ? items.findIndex((item) => item.isEnabled) : lastEnabledIndex(items);

    if (index >= 0) {
      focusItem(index);
    }
  }

  function focusAdjacentItem(direction: 1 | -1) {
    let nextIndex = focusedItemIndexRef.current;
    let remaining = items.length;

    while (remaining-- > 0) {
      nextIndex = cycle(items.length, nextIndex, direction);

      if (items[nextIndex]?.isEnabled) {
        focusItem(nextIndex);
        return;
      }
    }
  }

  function focusTypedItem(character: string) {
    typeaheadRef.current += character.toLowerCase();

    typeaheadTimer.start(() => {
      typeaheadRef.current = "";
    }, TYPEAHEAD_RESET_MS);

    const text = typeaheadRef.current;
    const focusedIndex = focusedItemIndexRef.current;
    const start = focusedIndex < 0 ? 0 : focusedIndex + (text.length === 1 ? 1 : 0);

    for (let step = 0; step < items.length; step++) {
      const index = (start + step) % items.length;
      const item = items[index];

      if (item?.isEnabled && item.label.toLowerCase().startsWith(text)) {
        focusItem(index);
        return;
      }
    }
  }

  function returnFocusToAnchor(isPointerActivation: boolean) {
    if (listRef.current?.contains(document.activeElement)) {
      // Restore focus to the anchor when an item activation leaves focus in the unmounted list (e.g. when opening a new tab).
      anchor?.focus({ preventScroll: true, focusVisible: isPointerActivation ? false : undefined });
    }
  }

  function activate(index: number, isPointerActivation = false) {
    if (!items[index]?.isEnabled || flash.isRunning()) {
      return;
    }

    focusedItemIndexRef.current = index;

    setFocusedItemIndex(index);
    playClickSound();

    flash.start(index, () => {
      onActivate(index);
      returnFocusToAnchor(isPointerActivation);
      onClose();
    });
  }

  const hasMovedFromPressOrigin = (event: PointerEvent) =>
    pressOrigin === null ||
    Math.hypot(event.clientX - pressOrigin.x, event.clientY - pressOrigin.y) > DRAG_THRESHOLD_PX;

  const onPointerMove = useEffectEvent((event: PointerEvent) => {
    if (hasMovedFromPressOrigin(event)) {
      isOpeningPressStationaryRef.current = false;
    }

    if (flash.isRunning() || isOpeningPressStationaryRef.current) {
      return;
    }

    const index = indexAt(event.clientX, event.clientY);

    focusItem(items[index]?.isEnabled ? index : -1);
  });

  const onPointerUp = useEffectEvent((event: PointerEvent) => {
    const wasSticky = isStickyRef.current;

    isStickyRef.current = true;

    if (!wasSticky && isOpeningPressStationaryRef.current && !hasMovedFromPressOrigin(event)) {
      return; // Ignore the release that opened the menu.
    }

    const index = indexAt(event.clientX, event.clientY);

    if (index >= 0) {
      if (!isPrimaryPress(event) || isBrowserHandledRelease?.(index, event)) {
        return;
      }

      activate(index, true);
    } else if (!wasSticky && !anchor?.contains(event.target as Node)) {
      onClose();
    }
  });

  const onPointerCancel = useEffectEvent(() => {
    // When the browser takes over a gesture (e.g., to scroll), it fires `pointercancel` instead of
    // `pointerup`. Mark the menu as sticky so the next press starts a new interaction rather than
    // ending the canceled opening hold.
    isStickyRef.current = true;

    if (!flash.isRunning()) {
      focusItem(-1);
    }
  });

  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    isOpeningPressStationaryRef.current = false;

    const isTargetInsideMenu =
      listRef.current?.contains(event.target as Node) || anchor?.contains(event.target as Node);

    if (isStickyRef.current && !isTargetInsideMenu) {
      onClose();
    }
  });

  useEffect(() => {
    listRef.current?.focus();

    const controller = new AbortController();
    const options = { signal: controller.signal };

    document.addEventListener("pointermove", onPointerMove, options);
    document.addEventListener("pointerup", onPointerUp, options);
    document.addEventListener("pointercancel", onPointerCancel, options);
    document.addEventListener("pointerdown", onPointerDown, options);

    return () => controller.abort();
  }, [listRef]);

  function onClick(event: MouseEvent) {
    const index = Number((event.target as Element).closest<HTMLElement>("[data-index]")?.dataset.index ?? -1);

    // A pointer's click follows the `pointerup` that has already activated the item.
    if (!isPointerClick(event) && index >= 0) {
      activate(index);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAdjacentItem(1);

        break;

      case "ArrowUp":
        event.preventDefault();
        focusAdjacentItem(-1);

        break;

      case "Home":
        event.preventDefault();
        focusEdgeItem("first");

        break;

      case "End":
        event.preventDefault();
        focusEdgeItem("last");

        break;

      case "Enter":
      case " ":
        event.preventDefault();

        if (focusedItemIndexRef.current >= 0) {
          activate(focusedItemIndexRef.current);
        }

        break;

      case "Escape":
      case "Tab":
        event.preventDefault();
        anchor?.focus();
        onClose();

        break;

      default:
        if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          focusTypedItem(event.key);
        }
    }
  }

  return {
    focusedItemIndex,
    isHighlighted: (index: number) => flash.highlightOf(index) ?? focusedItemIndex === index,
    onClick,
    onKeyDown,
  };
}
