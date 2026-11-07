import { memo, useId, useRef } from "react";
import { createPortal } from "react-dom";

import DownloadMenuItemIndicator from "#/assets/images/menu-item-indicator-download.svg?react";
import ExternalLinkMenuItemIndicator from "#/assets/images/menu-item-indicator-external-link.svg?react";
import { cx } from "#/lib/class-names.ts";
import type { Position } from "#/lib/geometry.ts";
import { useIsApplePlatform } from "#/lib/hooks/use-is-apple-platform.ts";
import { followLink, isBrowserHandledClick, isFollowingLink } from "#/lib/link.ts";
import { useMenuInteraction } from "#/lib/menu/use-menu-interaction.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./menu.module.css";

import type { MenuItem, MenuItemAccessory } from "./menu-items.ts";
import type { MouseEvent } from "react";

const CHAR_OPTION_KEY = "⌥";
const CHAR_NBSP = "\u00A0";
const CHAR_NARROW_NBSP = "\u202F";

const ACCESSORY_DESCRIPTIONS: Record<MenuItemAccessory, string> = {
  download: "Downloads a file",
  "external-link": "Opens in a new tab",
};

type MenuAction = Extract<MenuItem, { kind: "action" }>;

export type MenuOpener =
  /** A menu that drops down from its title, which names it and takes back the focus. */
  | { kind: "title"; title: HTMLElement; labelledBy: string }
  /** A context menu that opens at the point pressed. */
  | { kind: "point"; position: Position; pointerType: string; label: string };

const isEnabled = (entry: MenuItem | undefined) => entry?.kind === "action" && !entry.disabled;
const isLink = (entry: MenuItem | undefined) => entry?.kind === "action" && !entry.disabled && entry.href !== undefined;

function onItemClick(event: MouseEvent<HTMLAnchorElement>) {
  // Items activate from the document-level `pointerup` handler in `useMenuInteraction`, which waits for the activation
  // flash effect to finish before running the action or following the link. A modified or non-primary click keeps its
  // default behavior.
  if (!isFollowingLink(event.currentTarget) && !isBrowserHandledClick(event)) {
    event.preventDefault();
  }
}

function ShortcutHint({ label, isApplePlatform }: { label: string; isApplePlatform: boolean }) {
  return (
    // Hidden from assistive technology, which reads the shortcut from the item's `aria-keyshortcuts` attribute.
    <span className={styles.shortcut} aria-hidden>
      {isApplePlatform ? (
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

/**
 * Memoized because the menu rebuilds every row whenever the highlight moves (the menu builds the row elements inside a
 * `map`, which the React Compiler caches as one array).
 */
const MenuItemRow = memo(function MenuRow({
  item,
  index,
  id,
  isHighlighted,
  isApplePlatform,
}: {
  item: MenuAction;
  index: number;
  id: string;
  isHighlighted: boolean;
  isApplePlatform: boolean;
}) {
  const itemProps = {
    id,
    role: "menuitem" as const,
    className: cx(styles.item, item.disabled && styles.disabled, isHighlighted && styles.highlighted),
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
      {item.shortcut && <ShortcutHint label={item.shortcut.label} isApplePlatform={isApplePlatform} />}
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
  opener,
  isPointerHeld,
  focusesFirstItem,
  onOpenAdjacentMenu,
  onClose,
}: {
  items: Array<MenuItem>;
  opener: MenuOpener;
  isPointerHeld: boolean;
  /**
   * `true` for a menu opened with the keyboard or a `click` that does not end a press on its title, so the arrow keys
   * move from an item rather than from the menu itself. Read only when the menu mounts.
   */
  focusesFirstItem: boolean;
  /** `undefined` for a menu without adjacent menus. */
  onOpenAdjacentMenu?: (direction: 1 | -1) => void;
  onClose: () => void;
}) {
  const itemIdPrefix = useId();
  const isApplePlatform = useIsApplePlatform();
  const menuRef = useRef<HTMLDivElement>(null);
  const isContextMenu = opener.kind === "point";
  const opensAbovePoint = isContextMenu && opener.pointerType !== "mouse";

  const menuInteractionItems = items.map((item) => ({
    label: item.kind === "action" ? item.label : "",
    isEnabled: isEnabled(item),
  }));

  const { focusedItemIndex, isHighlighted, onClick, onKeyDown } = useMenuInteraction({
    items: menuInteractionItems,
    anchor: isContextMenu ? null : opener.title,
    listRef: menuRef,
    openingPress: {
      // A menu above a finger or pen stays open when it lifts, as it lifts away from the menu, like a touch device's
      // own context menus. A sticky menu still activates an item the press slides to and releases on.
      isPointerHeld: isPointerHeld && !opensAbovePoint,
      origin: isContextMenu ? opener.position : null, // A menu with a title opens below it rather than over the point pressed.
    },
    initialFocusedItemIndex: focusesFirstItem ? menuInteractionItems.findIndex((item) => item.isEnabled) : -1,
    isBrowserHandledRelease: (index, event) => isLink(items[index]) && isBrowserHandledClick(event),
    activatesOnNonPrimaryRelease: isContextMenu,
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

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      tabIndex={-1}
      className={cx(styles.menu, opensAbovePoint && styles.abovePoint)}
      aria-label={isContextMenu ? opener.label : undefined}
      aria-labelledby={isContextMenu ? undefined : opener.labelledBy}
      aria-activedescendant={focusedItemIndex >= 0 ? `${itemIdPrefix}-${focusedItemIndex}` : undefined}
      onClick={onClick}
      onContextMenu={isContextMenu ? (event) => event.preventDefault() : undefined}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          onOpenAdjacentMenu?.(event.key === "ArrowRight" ? 1 : -1);
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
            isHighlighted={isHighlighted(index)}
            isApplePlatform={isApplePlatform}
          />
        ),
      )}
    </div>
  );

  if (!isContextMenu) {
    return menu;
  }

  const pressPointStyle: StyleWithVars = {
    "--menu-press-x": `${opener.position.x}px`,
    "--menu-press-y": `${opener.position.y}px`,
  };

  return createPortal(
    <div className={styles.pressPoint} style={pressPointStyle}>
      {menu}
    </div>,
    document.body,
  );
}
