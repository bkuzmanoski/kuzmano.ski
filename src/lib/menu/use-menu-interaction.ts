import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";

import { playClickSound, playHoverSound } from "../audio/sounds.ts";
import { clientPositionOf, distanceBetween } from "../geometry.ts";
import { useActivationFlash } from "../hooks/use-activation-flash.ts";
import { useEventListeners } from "../hooks/use-event-listeners.ts";
import { useTimer } from "../hooks/use-timer.ts";
import { isFollowingLink } from "../link.ts";
import { navigationTargetOf } from "../list-navigation.ts";
import { isPointerClick, isPrimaryPress } from "../press/press.ts";
import { DRAG_THRESHOLD_PX } from "../press/use-pointer-drag.ts";

import type { Position } from "../geometry.ts";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";

const TYPEAHEAD_RESET_MS = 500;

export interface MenuInteractionItem {
  label: string;
  isEnabled: boolean;
}

/** The press that opened a menu. */
export interface OpeningPress {
  /** Whether the press is still down when the menu opens, so its release can choose an item. */
  isPointerHeld: boolean;
  /** `null` when the press was not at a known point, which treats any release as having moved. */
  origin: Position | null;
}

const ITEM_INDEX_ATTRIBUTE = "data-index";
const ITEM_SELECTOR = `[${ITEM_INDEX_ATTRIBUTE}]`;

/**
 * Returns the props that mark a menu item with its index, which `useMenuInteraction` reads to find the item under a
 * press or click.
 */
export const menuItemIndexProps = (index: number) => ({ [ITEM_INDEX_ATTRIBUTE]: index });

/** Returns the selector for the menu item that `menuItemIndexProps` marks with `index`. */
export const menuItemSelector = (index: number) => `[${ITEM_INDEX_ATTRIBUTE}="${index}"]`;

const itemIndexOf = (item: Element | null | undefined) => Number(item?.getAttribute(ITEM_INDEX_ATTRIBUTE) ?? -1);

/**
 * The index of the item under a point, or -1 if the point is not over one. The point is hit-tested rather than read
 * from an event's target, because on iOS a tap near an item can be retargeted to it for the compatibility mouse events
 * and `click`, while the touch pointer events remain on the element under the finger.
 */
function indexAt(x: number, y: number): number {
  return itemIndexOf(document.elementFromPoint(x, y)?.closest(ITEM_SELECTOR));
}

export function useMenuInteraction({
  items,
  anchor,
  listRef,
  openingPress,
  initialFocusedItemIndex,
  isBrowserHandledRelease,
  activatesOnNonPrimaryRelease = false,
  onActivate,
  onClose,
}: {
  items: ReadonlyArray<MenuInteractionItem>;
  anchor: HTMLElement | null;
  listRef: RefObject<HTMLElement | null>;
  openingPress: OpeningPress;
  /** `-1` if no item should have focus when the menu is first opened. */
  initialFocusedItemIndex: number;
  /** Whether the browser handles a release on the item, preventing menu activation. */
  isBrowserHandledRelease?: (index: number, event: PointerEvent) => boolean;
  /**
   * Whether releasing any button activates an item instead of only the primary button. Context menus enable this so the
   * user can release a secondary press held while opening the menu over an item.
   */
  activatesOnNonPrimaryRelease?: boolean;
  onActivate: (index: number) => void;
  onClose: () => void;
}) {
  const activationFlash = useActivationFlash<number>();
  const typeaheadTimer = useTimer();
  const [focusedItemIndex, setFocusedItemIndex] = useState(initialFocusedItemIndex);
  const pressOrigin = openingPress.origin;
  const isStickyRef = useRef(!openingPress.isPointerHeld);
  const isOpeningPressStationaryRef = useRef(pressOrigin !== null); // True until the opening press crosses the drag threshold or a new press begins.
  const focusedItemIndexRef = useRef(focusedItemIndex);
  const typeaheadRef = useRef("");
  const flashingItemIndexRef = useRef(-1); // The item whose activation flash is running, or `-1`.

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

  // A menu wraps at either end and skips its disabled items.
  function focusNavigationTarget(key: string) {
    const index = navigationTargetOf(key, focusedItemIndexRef.current, items.length, {
      wraps: true,
      isEnabled: (candidate) => items[candidate]?.isEnabled === true,
    });

    if (index !== null && index >= 0) {
      focusItem(index);
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
      // Restore focus to the anchor when an item activation leaves focus in the unmounted list (e.g., when opening a
      // new tab).
      anchor?.focus({ preventScroll: true, focusVisible: isPointerActivation ? false : undefined });
    }
  }

  function activate(index: number, isPointerActivation = false) {
    if (!items[index]?.isEnabled || activationFlash.isRunning()) {
      return;
    }

    focusedItemIndexRef.current = index;

    setFocusedItemIndex(index);
    playClickSound(); // Plays for every input, including a screen reader's activate action, unlike `usePressSound`.
    flashingItemIndexRef.current = index;

    activationFlash.start(index, () => {
      flashingItemIndexRef.current = -1;
      onActivate(index);
      returnFocusToAnchor(isPointerActivation);
      onClose();
    });
  }

  const activateFlashingItem = useEffectEvent(() => {
    const index = flashingItemIndexRef.current;

    if (index >= 0) {
      flashingItemIndexRef.current = -1;
      onActivate(index);
    }
  });

  // Unmounting cancels flash timers, so activate a flashing item during cleanup when its menu closes or is replaced. A
  // layout-effect cleanup runs while the list is attached, allowing link items to be followed; replacement menus retain
  // focus.
  useLayoutEffect(() => () => activateFlashingItem(), []);

  const hasMovedFromPressOrigin = (event: PointerEvent) =>
    pressOrigin === null || distanceBetween(clientPositionOf(event), pressOrigin) > DRAG_THRESHOLD_PX;

  const onPointerMove = (event: PointerEvent) => {
    if (hasMovedFromPressOrigin(event)) {
      isOpeningPressStationaryRef.current = false;
    }

    if (activationFlash.isRunning() || isOpeningPressStationaryRef.current) {
      return;
    }

    const index = indexAt(event.clientX, event.clientY);

    focusItem(items[index]?.isEnabled ? index : -1);
  };

  const onPointerUp = (event: PointerEvent) => {
    const wasSticky = isStickyRef.current;

    isStickyRef.current = true;

    if (activationFlash.isRunning()) {
      return;
    }

    if (isOpeningPressStationaryRef.current && !hasMovedFromPressOrigin(event)) {
      return; // Ignore the release that opened the menu.
    }

    const index = indexAt(event.clientX, event.clientY);

    if (index >= 0) {
      if ((!activatesOnNonPrimaryRelease && !isPrimaryPress(event)) || isBrowserHandledRelease?.(index, event)) {
        return;
      }

      activate(index, true);
    } else if (!wasSticky && !anchor?.contains(event.target as Node)) {
      onClose();
    }
  };

  const onPointerCancel = () => {
    // When the browser takes over a gesture (e.g., to scroll), it fires `pointercancel` instead of `pointerup`. Mark
    // the menu as sticky so the next press starts a new interaction rather than ending the canceled opening hold.
    isStickyRef.current = true;

    if (!activationFlash.isRunning()) {
      focusItem(-1);
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    isOpeningPressStationaryRef.current = false;

    const isTargetInsideMenu =
      listRef.current?.contains(event.target as Node) || anchor?.contains(event.target as Node);

    if (isStickyRef.current && !isTargetInsideMenu && !activationFlash.isRunning()) {
      onClose();
    }
  };

  useEffect(() => {
    listRef.current?.focus();
  }, [listRef]);

  useEventListeners("document", {
    pointermove: onPointerMove,
    pointerup: onPointerUp,
    pointercancel: onPointerCancel,
    pointerdown: onPointerDown,
  });

  function onClick(event: MouseEvent) {
    const item = (event.target as Element).closest<HTMLElement>(ITEM_SELECTOR);
    const index = itemIndexOf(item);

    // Pointer clicks and `followLink` clicks dispatched after a link item's activation flash belong to the activation
    // already handled by `pointerup`.
    if (!isPointerClick(event) && index >= 0 && !(item && isFollowingLink(item))) {
      activate(index);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (activationFlash.isRunning()) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Home":
      case "End":
        event.preventDefault();
        focusNavigationTarget(event.key);

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
    isHighlighted: (index: number) => activationFlash.highlightOf(index) ?? focusedItemIndex === index,
    onClick,
    onKeyDown,
  };
}
