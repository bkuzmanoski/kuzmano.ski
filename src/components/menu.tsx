import { memo, useEffect, useEffectEvent, useId, useRef, useState } from "react";

import DownloadIcon from "#/assets/images/download.svg?react";
import ExternalLinkIcon from "#/assets/images/external-link.svg?react";
import { playClick, playHover } from "#/lib/audio/sounds";
import { cx } from "#/lib/class-names";
import { useActivationFlash } from "#/lib/hooks/use-activation-flash";
import { useIsMacOS } from "#/lib/hooks/use-is-macos";
import { followLink, isBrowserHandledClick, isFollowingLink } from "#/lib/link";
import { cycle } from "#/lib/math";
import { isPrimaryPress } from "#/lib/press";

import styles from "./menu.module.css";

import type { KeyboardEvent, MouseEvent } from "react";

const CHAR_OPTION_KEY = "⌥";
const CHAR_NBSP = "\u00A0";
const CHAR_NARROW_NBSP = "\u202F";

export type MenuItem =
  | ({
      kind: "action";
      label: string;
      shortcut?: { code: string; label: string };
      accessory?: MenuItemAccessory;
    } & (
      | { href?: undefined; target?: undefined; disabled?: boolean; action: () => void }
      | { href: string; target?: "_blank"; disabled?: undefined; action?: () => void }
    ))
  | { kind: "separator" };

type MenuItemAccessory = "download" | "external-link";
type MenuAction = Extract<MenuItem, { kind: "action" }>;

const isEnabled = (entry: MenuItem | undefined) => entry?.kind === "action" && !entry.disabled;
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
// A modified or non-primary click is left to the browser.
function onItemClick(event: MouseEvent<HTMLAnchorElement>) {
  if (!isFollowingLink(event.currentTarget) && !isBrowserHandledClick(event)) {
    event.preventDefault();
  }
}

function ShortcutHint({ label, isMacOS }: { label: string; isMacOS: boolean }) {
  return (
    <span className={styles.shortcut}>
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
    "data-index": index,
  };
  const content = (
    <>
      <span>{item.label}</span>
      {item.shortcut && <ShortcutHint label={item.shortcut.label} isMacOS={isMacOS} />}
      {item.accessory === "download" && <DownloadIcon className={styles.accessory} />}
      {item.accessory === "external-link" && <ExternalLinkIcon className={styles.accessory} />}
    </>
  );

  return item.href ? (
    <a
      {...itemProps}
      href={item.href}
      rel={item.target}
      target={item.target}
      draggable={false}
      tabIndex={-1}
      onClick={onItemClick}
    >
      {content}
    </a>
  ) : (
    <div {...itemProps}>{content}</div>
  );
});

export function Menu({
  items,
  anchor,
  isPointerHeld,
  onOpenAdjacent,
  onClose,
}: {
  items: Array<MenuItem>;
  anchor: HTMLElement | null;
  isPointerHeld: boolean;
  onOpenAdjacent: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  const itemIdPrefix = useId();
  const isMacOS = useIsMacOS();
  const flash = useActivationFlash<number>();
  const [focusedItemId, setFocusedItemId] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const isStickyRef = useRef(!isPointerHeld);
  const focusedItemRef = useRef(-1);

  function focusItem(index: number) {
    if (index === focusedItemRef.current) {
      return;
    }

    focusedItemRef.current = index;
    setFocusedItemId(index);

    if (index >= 0) {
      playHover();
    }
  }

  function focusAdjacentMenuItem(direction: 1 | -1) {
    let next = focusedItemRef.current;
    let remaining = items.length;

    while (remaining-- > 0) {
      next = cycle(items.length, next, direction);

      if (isEnabled(items[next])) {
        focusItem(next);
        return;
      }
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

    focusedItemRef.current = index;
    setFocusedItemId(index);
    playClick();

    flash.start(index, () => {
      if (item.action) {
        item.action();
      } else {
        followLink(menuRef.current?.querySelector<HTMLAnchorElement>(`a[data-index="${index}"]`));
      }

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
        return; // A release the browser will act on itself is the anchor's, not the menu's.
      }

      select(index);
    } else if (!wasSticky && !anchor?.contains(event.target as Node)) {
      onClose();
    }
  });

  // A cancelled gesture never delivers its `pointerup`, so the hold ends here instead:
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

      case "ArrowRight":
        event.preventDefault();
        onOpenAdjacent(1);

        break;
      case "ArrowLeft":
        event.preventDefault();
        onOpenAdjacent(-1);

        break;

      case "Enter":
      case " ":
        event.preventDefault();

        if (focusedItemId >= 0) {
          select(focusedItemId);
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
      aria-activedescendant={focusedItemId >= 0 ? `${itemIdPrefix}-${focusedItemId}` : undefined}
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
            isActive={flash.isHighlighted(index, focusedItemId === index)}
            isMacOS={isMacOS}
          />
        ),
      )}
    </div>
  );
}
