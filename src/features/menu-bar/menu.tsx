import { memo, useId, useRef } from "react";

import DownloadMenuItemIndicator from "#/assets/images/menu-item-indicator-download.svg?react";
import ExternalLinkMenuItemIndicator from "#/assets/images/menu-item-indicator-external-link.svg?react";
import { cx } from "#/lib/class-names.ts";
import { useIsMacOS } from "#/lib/hooks/use-is-macos.ts";
import { useMenuInteraction } from "#/lib/hooks/use-menu-interaction.ts";
import { followLink, isBrowserHandledClick, isFollowingLink } from "#/lib/link.ts";

import styles from "./menu.module.css";

import type { MouseEvent } from "react";

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
const isLink = (entry: MenuItem | undefined) => entry?.kind === "action" && !entry.disabled && entry.href !== undefined;

function onItemClick(event: MouseEvent<HTMLAnchorElement>) {
  // Items activate from the document-level `pointerup` handler in `useMenuInteraction`, which
  // waits for the activation flash effect to finish before running the action or following the link.
  // A modified or non-primary click keeps its default behavior.
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
      <span>{item.label}</span>
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
  const menuRef = useRef<HTMLDivElement>(null);

  const menuInteractionItems = items.map((item) => ({
    label: item.kind === "action" ? item.label : "",
    isEnabled: isEnabled(item),
  }));

  const { focusedItemIndex, isHighlighted, onClick, onKeyDown } = useMenuInteraction({
    items: menuInteractionItems,
    anchor,
    listRef: menuRef,
    isPointerHeld,
    pressOrigin: null, // The menu opens below its title rather than over the point pressed.
    initialFocusedItemIndex: focusesFirstItem ? menuInteractionItems.findIndex((item) => item.isEnabled) : -1,
    isBrowserHandledRelease: (index, event) => isLink(items[index]) && isBrowserHandledClick(event),
    onActivate: (index) => {
      const item = items[index];

      if (item?.kind !== "action") {
        return;
      }

      if (item.action) {
        item.action();
      } else {
        followLink(menuRef.current?.querySelector<HTMLAnchorElement>(`a[data-index="${index}"]`));
      }
    },
    onClose,
  });

  return (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className={styles.menu}
      aria-labelledby={labelledBy}
      aria-activedescendant={focusedItemIndex >= 0 ? `${itemIdPrefix}-${focusedItemIndex}` : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          onOpenAdjacentMenu(event.key === "ArrowRight" ? 1 : -1);
        } else {
          onKeyDown(event);
        }
      }}
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
            isActive={isHighlighted(index)}
            isMacOS={isMacOS}
          />
        ),
      )}
    </div>
  );
}
