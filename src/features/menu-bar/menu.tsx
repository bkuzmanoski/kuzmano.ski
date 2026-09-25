import { memo, useEffect, useEffectEvent, useId, useRef, useState } from "react";

import DownloadMenuItemIndicator from "#/assets/images/menu-item-indicator-download.svg?react";
import ExternalLinkMenuItemIndicator from "#/assets/images/menu-item-indicator-external-link.svg?react";
import { playClick, playHover } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { useActivationFlash } from "#/lib/hooks/use-activation-flash.ts";
import { useIsMacOS } from "#/lib/hooks/use-is-macos.ts";
import { followLink, isBrowserHandledClick, isFollowingLink } from "#/lib/link.ts";
import { cycle } from "#/lib/math.ts";
import { isPrimaryPress } from "#/lib/press.ts";

import styles from "./menu.module.css";

import type { KeyboardEvent, MouseEvent } from "react";

const CHAR_OPTION_KEY = "⌥";
const CHAR_NBSP = "\u00A0";
const CHAR_NARROW_NBSP = "\u202F";

const ACCESSORY_DESCRIPTIONS: Record<MenuItemAccessory, string> = {
  download: "Downloads a file",
  "external-link": "Opens in a new tab",
};

interface MenuShortcut {
  code: string;
  label: string;
}

export type MenuItem =
  | ({
      kind: "action";
      label: string;
      accessory?: MenuItemAccessory;
    } & (
      | { href?: undefined; target?: undefined; disabled?: boolean; action: () => void; shortcut?: MenuShortcut }
      | { href: string; target?: "_blank"; disabled?: undefined; action: () => void; shortcut?: MenuShortcut }
      | { href: string; target?: "_blank"; disabled?: undefined; action?: undefined; shortcut?: undefined }
    ))
  | { kind: "separator" };

type MenuItemAccessory = "download" | "external-link";
type MenuAction = Extract<MenuItem, { kind: "action" }>;

const isEnabled = (entry: MenuItem | undefined) => entry?.kind === "action" && !entry.disabled;
const firstEnabledIndex = (items: Array<MenuItem>) => items.findIndex(isEnabled);

function lastEnabledIndex(items: Array<MenuItem>): number {
  for (let index = items.length - 1; index >= 0; index--) {
    if (isEnabled(items[index])) {
      return index;
    }
  }

  return -1;
}

const isLink = (entry: MenuItem | undefined) => entry?.kind === "action" && !entry.disabled && entry.href !== undefined;

// The index of the item under a point, or -1 if the point is not over one.
function indexAt(x: number, y: number): number {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-index]");
  return element ? Number(element.dataset.index) : -1;
}

// Items activate from the document-level `pointerup` handler in `Menu`: `select` waits for the
// activation flash effect to finish, then runs the action or follows the link. A plain click is
// suppressed here so the anchor cannot navigate before that.
//
// A modified or non-primary click is left for the browser to handle.
function onItemClick(event: MouseEvent<HTMLAnchorElement>) {
  if (!isFollowingLink(event.currentTarget) && !isBrowserHandledClick(event)) {
    event.preventDefault();
  }
}

function ShortcutHint({ label, isMacOS }: { label: string; isMacOS: boolean }) {
  return (
    // Hidden from assistive technology, which reads the shortcut from the item's `aria-keyshortcuts` attribute.
    <span className={styles.shortcut} aria-hidden>
      {isMacOS ? (
        <>
          <span className={styles.modifierIcon}>{CHAR_OPTION_KEY}</span>
          {CHAR_NBSP}
        </>
      ) : (
        `Alt${CHAR_NARROW_NBSP}+${CHAR_NARROW_NBSP}`
      )}
      {label}
    </span>
  );
}

// Memoized because the menu rebuilds every row whenever the highlight moves (the row
// elements are built inside a `map`, which the React Compiler caches as one array).
const MenuItemRow = memo(function MenuRow({
  item,
  index,
  id,
  isActive,
  isMacOS,
}: {
  item: MenuAction;
  index: number;
  id: string;
  isActive: boolean;
  isMacOS: boolean;
}) {
  const itemProps = {
    id,
    role: "menuitem" as const,
    className: cx(styles.item, item.disabled && styles.disabled, isActive && styles.active),
    "aria-disabled": item.disabled || undefined,
    "aria-keyshortcuts": item.shortcut ? `Alt+${item.shortcut.label}` : undefined,
    "aria-describedby": item.accessory ? `${id}-description` : undefined,
    "data-index": index,
  };
  const itemContent = (
    <>
      <span className={styles.label}>{item.label}</span>
      {item.accessory && (
        <span id={`${id}-description`} hidden>
          {ACCESSORY_DESCRIPTIONS[item.accessory]}
        </span>
      )}
      {item.shortcut && <ShortcutHint label={item.shortcut.label} isMacOS={isMacOS} />}
      {item.accessory === "download" && <DownloadMenuItemIndicator className={styles.menuItemIndicator} />}
      {item.accessory === "external-link" && <ExternalLinkMenuItemIndicator className={styles.menuItemIndicator} />}
    </>
  );

  return item.href ? (
    <a
      {...itemProps}
      href={item.href}
      target={item.target}
      download={item.accessory === "download" || undefined}
      draggable={false}
      tabIndex={-1}
      onClick={onItemClick}
    >
      {itemContent}
    </a>
  ) : (
    <div {...itemProps}>{itemContent}</div>
  );
});

export function Menu({
  items,
  anchor,
  labelledBy,
  isPointerHeld,
  focusesFirstItem,
  onOpenAdjacentMenu,
  onClose,
}: {
  items: Array<MenuItem>;
  anchor: HTMLElement | null;
  labelledBy: string;
  isPointerHeld: boolean;
  focusesFirstItem: boolean; // Set when the menu is opened with the keyboard, so the arrow keys move from an item rather than from the menu itself.
  onOpenAdjacentMenu: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  const itemIdPrefix = useId();
  const isMacOS = useIsMacOS();
  const flash = useActivationFlash<number>();
  const [focusedItemIndex, setFocusedItemIndex] = useState(() => (focusesFirstItem ? firstEnabledIndex(items) : -1));
  const menuRef = useRef<HTMLDivElement>(null);
  const isStickyRef = useRef(!isPointerHeld);
  const focusedItemIndexRef = useRef(focusedItemIndex);

  function focusItem(index: number) {
    if (index === focusedItemIndexRef.current) {
      return;
    }

    focusedItemIndexRef.current = index;

    setFocusedItemIndex(index);

    if (index >= 0) {
      playHover();
    }
  }

  function focusEdgeMenuItem(edge: "first" | "last") {
    const index = edge === "first" ? firstEnabledIndex(items) : lastEnabledIndex(items);

    if (index >= 0) {
      focusItem(index);
    }
  }

  function focusAdjacentMenuItem(direction: 1 | -1) {
    let nextIndex = focusedItemIndexRef.current;
    let remaining = items.length;

    while (remaining-- > 0) {
      nextIndex = cycle(items.length, nextIndex, direction);

      if (isEnabled(items[nextIndex])) {
        focusItem(nextIndex);
        return;
      }
    }
  }

  function returnFocusToTitle() {
    // Choosing an item whose action does not move the focus, such as one that opens a new tab, would
    // leave the focus on the body once the focused menu unmounts, so it returns to the title that
    // opened the menu instead. A press outside the menu that closes it leaves the focus where it landed.
    if (menuRef.current?.contains(document.activeElement)) {
      anchor?.focus({ preventScroll: true });
    }
  }

  // A plain function, not an Effect Event as the keyboard path calls it straight
  // from `onKeyDown`. The pointer handlers below are Effect Events, so they
  // always close over the latest render's copy of this.
  function select(index: number) {
    const item = items[index];

    if (item?.kind !== "action" || item.disabled || flash.isRunning()) {
      return;
    }

    focusedItemIndexRef.current = index;

    setFocusedItemIndex(index);
    playClick();

    flash.start(index, () => {
      if (item.action) {
        item.action();
      } else {
        followLink(menuRef.current?.querySelector<HTMLAnchorElement>(`a[data-index="${index}"]`));
      }

      returnFocusToTitle();
      onClose();
    });
  }

  const onPointerMove = useEffectEvent((event: PointerEvent) => {
    if (flash.isRunning()) {
      return;
    }

    const index = indexAt(event.clientX, event.clientY);

    focusItem(isEnabled(items[index]) ? index : -1);
  });

  const onPointerUp = useEffectEvent((event: PointerEvent) => {
    const index = indexAt(event.clientX, event.clientY);
    const wasSticky = isStickyRef.current;

    isStickyRef.current = true;

    if (index >= 0) {
      if (!isPrimaryPress(event)) {
        return;
      }

      if (isLink(items[index]) && isBrowserHandledClick(event)) {
        return; // The browser acts on a modified release itself, so the anchor navigates instead of the menu selecting.
      }

      select(index);
    } else if (!wasSticky && !anchor?.contains(event.target as Node)) {
      onClose();
    }
  });

  // A canceled gesture never delivers its `pointerup`, so the hold ends here instead:
  // the menu turns sticky and waits for a press, rather than reading a later unrelated
  // release as the end of a hold that is long over.
  const onPointerCancel = useEffectEvent(() => {
    isStickyRef.current = true;

    if (!flash.isRunning()) {
      focusItem(-1);
    }
  });

  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    const isInside = menuRef.current?.contains(event.target as Node) || anchor?.contains(event.target as Node);

    if (isStickyRef.current && !isInside) {
      onClose();
    }
  });

  useEffect(() => {
    menuRef.current?.focus();

    const controller = new AbortController();
    const options = { signal: controller.signal };

    document.addEventListener("pointermove", onPointerMove, options);
    document.addEventListener("pointerup", onPointerUp, options);
    document.addEventListener("pointercancel", onPointerCancel, options);
    document.addEventListener("pointerdown", onPointerDown, options);

    return () => controller.abort();
  }, []);

  function onKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAdjacentMenuItem(1);

        break;

      case "ArrowUp":
        event.preventDefault();
        focusAdjacentMenuItem(-1);

        break;

      case "Home":
        event.preventDefault();
        focusEdgeMenuItem("first");

        break;

      case "End":
        event.preventDefault();
        focusEdgeMenuItem("last");

        break;

      case "ArrowRight":
        event.preventDefault();
        onOpenAdjacentMenu(1);

        break;
      case "ArrowLeft":
        event.preventDefault();
        onOpenAdjacentMenu(-1);

        break;

      case "Enter":
      case " ":
        event.preventDefault();

        if (focusedItemIndex >= 0) {
          select(focusedItemIndex);
        }

        break;

      case "Escape":
      case "Tab":
        event.preventDefault();
        anchor?.focus(); // Return the focus to the title so the menu bar stays navigable by keyboard.
        onClose();

        break;
    }
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className={styles.menu}
      aria-labelledby={labelledBy}
      aria-activedescendant={focusedItemIndex >= 0 ? `${itemIdPrefix}-${focusedItemIndex}` : undefined}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) =>
        item.kind === "separator" ? (
          <hr key={`separator-${index}`} className={styles.separator} />
        ) : (
          <MenuItemRow
            key={item.label}
            item={item}
            index={index}
            id={`${itemIdPrefix}-${index}`}
            isActive={flash.isHighlighted(index, focusedItemIndex === index)}
            isMacOS={isMacOS}
          />
        ),
      )}
    </div>
  );
}
