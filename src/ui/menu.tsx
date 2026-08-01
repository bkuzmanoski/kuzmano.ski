import clsx from "clsx";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import DownloadIcon from "#/assets/images/download.svg?react";
import ExternalLinkIcon from "#/assets/images/external-link.svg?react";
import OptionIcon from "#/assets/images/option-modifier.svg?react";
import { useIsWindows } from "#/lib/keyboard-shortcut";
import { cycle } from "#/lib/math";
import { playClick } from "#/lib/sound";

import styles from "./menu.module.css";

import type { KeyboardEvent } from "react";

export type MenuItem =
  | {
      kind: "action";
      label: string;
      shortcut?: { code: string; label: string };
      accessory?: MenuItemAccessory;
      disabled?: boolean;
      trigger: () => void;
    }
  | { kind: "separator" };

type MenuItemAccessory = "download" | "external-link";

const ACTIVATION_FLASH_MS = 90;

const isEnabled = (entry: MenuItem | undefined) => entry?.kind === "action" && !entry.disabled;

export function Menu({
  items,
  anchor,
  isPointerHeld,
  onClose,
}: {
  items: Array<MenuItem>;
  anchor: HTMLElement | null;
  isPointerHeld: boolean;
  onClose: () => void;
}) {
  const [focusedItemId, setFocusedItemId] = useState(-1);
  const [isFlashing, setIsFlashing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isStickyRef = useRef(!isPointerHeld);
  const flashTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => () => flashTimersRef.current.forEach(clearTimeout), []);

  /* A selection is a one-way door: it flashes, triggers, and closes the menu.
   * The latch stops a second press during the flash from starting another one. */
  const isSelecting = () => flashTimersRef.current.length > 0;

  /* A plain function, not an Effect Event as the keyboard path calls it straight
   * from `onKeyDown`. The pointer handlers below are Effect Events, so they
   * always close over the latest render's copy of this. */
  function select(index: number) {
    const item = items[index];

    if (!item || item.kind !== "action" || item.disabled || isSelecting()) {
      return;
    }

    setFocusedItemId(index);
    setIsFlashing(true);
    playClick();

    flashTimersRef.current.push(
      setTimeout(() => {
        setIsFlashing(false);

        flashTimersRef.current.push(
          setTimeout(() => {
            item.trigger();
            onClose();
          }, ACTIVATION_FLASH_MS),
        );
      }, ACTIVATION_FLASH_MS),
    );
  }

  function indexAt(x: number, y: number): number {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-index]");
    return element ? Number(element.dataset.index) : -1;
  }

  function focusAdjacentMenuItem(direction: 1 | -1) {
    setFocusedItemId((current) => {
      let next = current;
      let remaining = items.length;

      while (remaining-- > 0) {
        next = cycle(items.length, next, direction);

        if (isEnabled(items[next])) {
          return next;
        }
      }

      return current;
    });
  }

  const onPointerMove = useEffectEvent((event: PointerEvent) => {
    if (!isSelecting()) {
      setFocusedItemId(indexAt(event.clientX, event.clientY));
    }
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

  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    const isInside = menuRef.current?.contains(event.target as Node) || anchor?.contains(event.target as Node);

    if (isStickyRef.current && !isInside) {
      onClose();
    }
  });

  useEffect(() => {
    menuRef.current?.focus();

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointerdown", onPointerDown);
    };
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
        onClose();

        break;
    }
  }

  return (
    <div ref={menuRef} className={styles.menu} role="menu" tabIndex={-1} onKeyDown={onKeyDown}>
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
              focusedItemId === index && !isFlashing && styles.active,
            )}
            data-index={index}
            role="menuitem"
          >
            <span>{item.label}</span>
            {item.shortcut && <ShortcutHint label={item.shortcut.label} />}
            {item.accessory === "download" && <DownloadIcon className={styles.accessory} />}
            {item.accessory === "external-link" && <ExternalLinkIcon className={styles.accessory} />}
          </div>
        ),
      )}
    </div>
  );
}

function ShortcutHint({ label }: { label: string }) {
  const isWindows = useIsWindows();

  return (
    <span className={styles.shortcut}>
      {isWindows ? <span>Alt+</span> : <OptionIcon className={styles.modifier} />}
      <span>{label}</span>
    </span>
  );
}
