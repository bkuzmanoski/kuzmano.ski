import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import DownloadIcon from "#/assets/images/download.svg?react";
import ExternalLinkIcon from "#/assets/images/external-link.svg?react";
import OptionIcon from "#/assets/images/option-modifier.svg?react";
import { useIsWindows } from "#/lib/keyboard-shortcut";
import { playClick } from "#/lib/sound";

import styles from "./menu.module.css";

import type { KeyboardEvent } from "react";

export type MenuItemAccessory = "download" | "external-link";

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
  const latestPropsRef = useRef({ items, anchor, onClose });

  useEffect(() => {
    latestPropsRef.current = { items, anchor, onClose };
  });

  useEffect(() => () => flashTimersRef.current.forEach(clearTimeout), []);

  const isMenuFlashing = () => flashTimersRef.current.length > 0;

  // TODO: Flash 2/3 times
  function select(index: number) {
    const item = latestPropsRef.current.items[index];

    if (!item || item.kind !== "action" || item.disabled || isMenuFlashing()) {
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
            latestPropsRef.current.onClose();
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
        next = (next + direction + items.length) % items.length;

        if (isEnabled(items[next])) {
          return next;
        }
      }

      return current;
    });
  }

  useEffect(() => {
    menuRef.current?.focus();

    function onPointerMove(event: PointerEvent) {
      if (!isMenuFlashing()) {
        setFocusedItemId(indexAt(event.clientX, event.clientY));
      }
    }

    function onPointerUp(event: PointerEvent) {
      const index = indexAt(event.clientX, event.clientY);

      // Resolve the press that opened the menu (drag-to-select or click-to-stick).
      if (!isStickyRef.current) {
        isStickyRef.current = true;

        if (index >= 0) {
          select(index);
        } else if (!latestPropsRef.current.anchor?.contains(event.target as Node)) {
          latestPropsRef.current.onClose();
        }

        return;
      }

      // After the menu sticks open, a release on an item selects it.
      if (index >= 0) {
        select(index);
      }
    }

    function onPointerDown(event: PointerEvent) {
      // A press outside the menu and its title closes the menu.
      const isInside =
        menuRef.current?.contains(event.target as Node) ||
        latestPropsRef.current.anchor?.contains(event.target as Node);

      if (isStickyRef.current && !isInside) {
        latestPropsRef.current.onClose();
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []); // Latest values come through the latestPropsRef ref; no dependencies needed

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
