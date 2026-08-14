import clsx from "clsx";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";

import DownloadIcon from "#/assets/images/download.svg?react";
import ExternalLinkIcon from "#/assets/images/external-link.svg?react";
import { playClick, playHover } from "#/lib/audio/ui";
import { useActivationFlash } from "#/lib/hooks/use-activation-flash";
import { useIsMacOS } from "#/lib/hooks/use-is-macos";
import { cycle } from "#/lib/math";

import styles from "./menu.module.css";

import type { KeyboardEvent } from "react";

const CHAR_OPTION_KEY = "\u2325";
const CHAR_NBSP = "\u00A0";
const NARROW_NBSP = "\u202F";

export type MenuItem =
  | {
      kind: "action";
      label: string;
      shortcut?: { code: string; label: string };
      accessory?: MenuItemAccessory;
      disabled?: boolean;
      action: () => void;
    }
  | { kind: "separator" };

type MenuItemAccessory = "download" | "external-link";

const isEnabled = (entry: MenuItem | undefined) => entry?.kind === "action" && !entry.disabled;

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
  const isMacOS = useIsMacOS();
  const flash = useActivationFlash<number>();
  const [focusedItemId, setFocusedItemId] = useState(-1);
  const itemIdPrefix = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const isStickyRef = useRef(!isPointerHeld);
  const focusedItemRef = useRef(-1);

  /* A plain function, not an Effect Event as the keyboard path calls it straight
   * from `onKeyDown`. The pointer handlers below are Effect Events, so they
   * always close over the latest render's copy of this. */
  function select(index: number) {
    const item = items[index];

    if (item?.kind !== "action" || item.disabled || flash.isRunning()) {
      return;
    }

    focusedItemRef.current = index;
    setFocusedItemId(index);
    playClick();

    flash.start(index, () => {
      item.action();
      onClose();
    });
  }

  function indexAt(x: number, y: number): number {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-index]");
    return element ? Number(element.dataset.index) : -1;
  }

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

  const onPointerMove = useEffectEvent((event: PointerEvent) => {
    if (flash.isRunning()) {
      return;
    }

    const index = indexAt(event.clientX, event.clientY);

    focusItem(isEnabled(items[index]) ? index : -1);
  });

  const onPointerUp = useEffectEvent((event: PointerEvent) => {
    const index = indexAt(event.clientX, event.clientY);

    if (!isStickyRef.current) {
      isStickyRef.current = true;

      if (index >= 0) {
        select(index);
      } else if (!anchor?.contains(event.target as Node)) {
        onClose();
      }

      return;
    }

    if (index >= 0) {
      select(index);
    }
  });

  /* A cancelled gesture never delivers its `pointerup`, so the hold ends here instead:
   * the menu turns sticky and waits for a press, rather than reading a later unrelated
   * release as the end of a hold that is long over. */
  const onPointerCancel = useEffectEvent(() => {
    isStickyRef.current = true;

    if (!flash.isRunning()) {
      focusItem(-1); // The pointer is gone, so nothing is under it to keep highlighted.
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

    const listening = new AbortController();
    const options = { signal: listening.signal };

    document.addEventListener("pointermove", onPointerMove, options);
    document.addEventListener("pointerup", onPointerUp, options);
    document.addEventListener("pointercancel", onPointerCancel, options);
    document.addEventListener("pointerdown", onPointerDown, options);

    return () => listening.abort();
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
      aria-activedescendant={focusedItemId >= 0 ? `${itemIdPrefix}-${focusedItemId}` : undefined}
      className={styles.menu}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) =>
        item.kind === "separator" ? (
          <div key={index} className={styles.separator} role="separator" />
        ) : (
          <div
            key={index}
            aria-disabled={item.disabled || undefined}
            className={clsx(
              styles.item,
              item.disabled && styles.disabled,
              flash.isHighlighted(index, focusedItemId === index) && styles.active,
            )}
            data-index={index}
            id={`${itemIdPrefix}-${index}`}
            role="menuitem"
          >
            <span>{item.label}</span>
            {item.shortcut && <ShortcutHint label={item.shortcut.label} isMacOS={isMacOS} />}
            {item.accessory === "download" && <DownloadIcon className={styles.accessory} />}
            {item.accessory === "external-link" && <ExternalLinkIcon className={styles.accessory} />}
          </div>
        ),
      )}
    </div>
  );
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
        `Alt${NARROW_NBSP}+${NARROW_NBSP}`
      )}
      {label}
    </span>
  );
}
