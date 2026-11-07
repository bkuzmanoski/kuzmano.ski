import { useId, useRef, useState } from "react";

import Logo from "#/assets/images/logo.svg?react";
import { joinedWithSeparators } from "#/components/menu-items.ts";
import type { MenuItem } from "#/components/menu-items.ts";
import { Menu } from "#/components/menu.tsx";
import { FEATURE_ROUTE_SPECS } from "#/config/feature-routes.ts";
import { DESTINATION_GROUPS, DESTINATION_ORDER } from "#/config/navigation.ts";
import type { DestinationId } from "#/config/navigation.ts";
import { SITE_NAME, SITE_SOURCE_URL } from "#/config/site.ts";
import { playClickSound, playHoverSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { useGlobalShortcuts } from "#/lib/hooks/use-global-shortcuts.ts";
import type { KeyboardShortcut } from "#/lib/hooks/use-global-shortcuts.ts";
import { cycle } from "#/lib/math.ts";
import { useMenuButtonPress } from "#/lib/menu/use-menu-button-press.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { isPrimaryPress } from "#/lib/press/press.ts";
import { sleep } from "#/lib/screensaver/lifecycle.ts";
import { restart, useIsStartupSequenceComplete } from "#/lib/startup-sequence/lifecycle.ts";
import { useFocusedWindow, useWindowActions, useWindowContent } from "#/lib/window-manager/context.ts";
import { SITE_FEED } from "#/site/feeds.ts";
import { DESTINATIONS } from "#/site/navigation.ts";
import { isFeatureWindow, windowAlternateRepresentationsOf } from "#/site/windows.ts";

import styles from "./menu-bar.module.css";
import { AppearanceStatus, SoundStatus, TimeStatus } from "./status-items.tsx";

import type { ComponentProps, ComponentType, KeyboardEvent } from "react";

const destinationShortcut = (id: DestinationId) => {
  const shortcutNumber = DESTINATION_ORDER.indexOf(id) + 1;
  return { code: `Digit${shortcutNumber}`, label: String(shortcutNumber) };
};

function MenuTitle({
  label,
  icon: Icon,
  isOpen,
  onPress,
  onActivate,
  ...buttonProps
}: {
  label: string;
  icon?: ComponentType<{ className?: string }> | undefined;
  isOpen: boolean;
  onPress: (anchor: HTMLButtonElement) => void;
  onActivate: (anchor: HTMLButtonElement) => void;
} & Pick<ComponentProps<"button">, "ref" | "id" | "onKeyDown" | "onPointerDown" | "onPointerEnter">) {
  const menuButtonPressHandlers = useMenuButtonPress({
    onPress: ({ currentTarget }) => onPress(currentTarget),
    onActivate: ({ currentTarget }) => onActivate(currentTarget),
  });
  return (
    <button
      type="button"
      className={cx(styles.title, isOpen && styles.open)}
      aria-label={Icon ? label : undefined}
      aria-expanded={isOpen}
      aria-haspopup="menu"
      {...mergeHandlers(menuButtonPressHandlers, buttonProps)}
    >
      {Icon ? <Icon className={styles.titleIcon} /> : label}
    </button>
  );
}

export function MenuBar() {
  const { open, close, toggleZoom, cycleWindows } = useWindowActions();
  const focusedWindow = useFocusedWindow();
  const windowContent = useWindowContent();
  const isStartupSequenceComplete = useIsStartupSequenceComplete();
  const [openMenu, setOpenMenu] = useState<{
    label: string;
    anchor: HTMLButtonElement;
    isPointerHeld: boolean;
    focusesFirstItem: boolean;
  } | null>(null);
  const titleIdPrefix = useId();
  const titleElementsRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const titlePressPointerIdRef = useRef<number | null>(null);

  const isWindowFocused = focusedWindow !== null;
  const isContentWindowFocused = isWindowFocused && !isFeatureWindow(focusedWindow);
  const focusedWindowRoute = focusedWindow && windowContent[focusedWindow]?.route;
  const alternateRepresentations = focusedWindowRoute ? windowAlternateRepresentationsOf(focusedWindowRoute) : null;
  const feed = alternateRepresentations && (alternateRepresentations.feed ?? SITE_FEED); // A page has no feed of its own but its document links the site feed.

  const printWindow = () => requestAnimationFrame(() => requestAnimationFrame(() => print())); // Two frames: the menu closes after the action runs, and must paint closed before `print()` blocks rendering.
  const closeWindow = () => focusedWindow && close(focusedWindow);

  const alternateRepresentationItems = [
    { label: "Show Markdown", href: alternateRepresentations?.markdownRepresentationPath },
    { label: "Show Atom Feed", href: feed?.path },
  ].flatMap(({ label, href }): Array<MenuItem> =>
    href ? [{ kind: "action", label, accessory: "external-link", href, target: "_blank" }] : [],
  );

  const menus: Array<{ label: string; icon?: ComponentType<{ className?: string }>; items: Array<MenuItem> }> = [
    {
      label: SITE_NAME,
      icon: Logo,
      items: [
        {
          kind: "action",
          label: FEATURE_ROUTE_SPECS.controlPanel.title,
          href: FEATURE_ROUTE_SPECS.controlPanel.route,
          action: () => open(FEATURE_ROUTE_SPECS.controlPanel.route),
        },
        { kind: "separator" },
        { kind: "action", label: "View Source", accessory: "external-link", href: SITE_SOURCE_URL, target: "_blank" },
        { kind: "separator" },
        { kind: "action", label: "Sleep", action: sleep },
        { kind: "action", label: "Restart", action: restart },
      ],
    },
    {
      label: "File",
      items: joinedWithSeparators([
        alternateRepresentationItems,
        isContentWindowFocused ? [{ kind: "action", label: "Print…", action: printWindow }] : [],
        [
          {
            kind: "action",
            label: "Close",
            shortcut: { code: "KeyW", label: "W" },
            disabled: !isWindowFocused,
            action: closeWindow,
          },
        ],
      ]),
    },
    {
      label: "Go",
      items: joinedWithSeparators(
        DESTINATION_GROUPS.map((group) =>
          group.map((id): MenuItem => ({
            kind: "action",
            label: DESTINATIONS[id].title,
            shortcut: destinationShortcut(id),
            href: DESTINATIONS[id].route,
            action: () => open(DESTINATIONS[id].route),
          })),
        ),
      ),
    },
  ];

  useGlobalShortcuts([
    ...menus.flatMap(({ items }) =>
      items.flatMap((item): Array<KeyboardShortcut> =>
        item.kind === "action" && item.shortcut
          ? [{ code: item.shortcut.code, run: item.action, enabled: !item.disabled }]
          : [],
      ),
    ),
    { code: "Space", run: () => focusedWindow && toggleZoom(focusedWindow), invokesWhileEditing: true },
    { code: "Tab", run: cycleWindows, invokesWhileEditing: true },
  ]);

  function openMenuAt(
    label: string,
    anchor: HTMLButtonElement,
    { isPointerHeld = false, focusesFirstItem = false } = {},
  ) {
    setOpenMenu({ label, anchor, isPointerHeld, focusesFirstItem });
  }

  // On touch, the press that dismisses an open menu can also open the next menu. There is no hover to switch menus
  // first, so the new menu replaces the old one before its outside-press handler runs. Closing by label leaves the
  // replacement open.
  function closeMenu(label: string) {
    setOpenMenu((current) => (current?.label === label ? null : current));
  }

  // Arrow keys always move along the menu bar. With a menu open, the adjacent menu replaces it and receives focus;
  // otherwise only the title receives focus.
  function openAdjacentMenu(fromLabel: string, direction: 1 | -1) {
    const index = menus.findIndex((menu) => menu.label === fromLabel);
    const label = menus[cycle(menus.length, index, direction)]!.label;
    const anchor = titleElementsRef.current[label];

    if (!anchor) {
      return;
    }

    if (openMenu) {
      playHoverSound();
      openMenuAt(label, anchor, { focusesFirstItem: true });
    } else {
      anchor.focus();
    }
  }

  // Focuses the title before the menu mounts, as the title prevents the default action of its `mousedown`.
  function onTitlePress(anchor: HTMLButtonElement, label: string) {
    anchor.focus({ focusVisible: false });
    setOpenMenu((current) =>
      current?.label === label ? null : { label, anchor, isPointerHeld: true, focusesFirstItem: false },
    );
  }

  function onTitleActivate(anchor: HTMLButtonElement, label: string) {
    if (openMenu?.label === label) {
      closeMenu(label);
    } else {
      openMenuAt(label, anchor, { focusesFirstItem: true });
    }
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLButtonElement>, label: string) {
    switch (event.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
        event.preventDefault();
        playClickSound();
        openMenuAt(label, event.currentTarget, { focusesFirstItem: true });

        break;

      case "ArrowRight":
        event.preventDefault();
        openAdjacentMenu(label, 1);

        break;

      case "ArrowLeft":
        event.preventDefault();
        openAdjacentMenu(label, -1);

        break;
    }
  }

  return (
    <header className={cx(styles.menuBar, isStartupSequenceComplete && styles.ready)}>
      <nav className={styles.menus} aria-label="Main menu">
        {menus.map(({ label, icon: Icon, items }, menuIndex) => (
          <div key={label} className={styles.item}>
            <MenuTitle
              ref={(node) => {
                titleElementsRef.current[label] = node;
              }}
              id={`${titleIdPrefix}-${menuIndex}`}
              label={label}
              icon={Icon}
              isOpen={openMenu?.label === label}
              onPress={(anchor) => onTitlePress(anchor, label)}
              onActivate={(anchor) => onTitleActivate(anchor, label)}
              onKeyDown={(event) => onTitleKeyDown(event, label)}
              onPointerDown={(event) => {
                if (isPrimaryPress(event)) {
                  titlePressPointerIdRef.current = event.pointerId;
                }
              }}
              onPointerEnter={(event) => {
                // The browser dispatches `pointerenter` before `pointerdown` for a new touch, so opening a menu here
                // would let the touch's `pointerdown` close it again. This handler opens a menu for a touch only when
                // the touch began with a press on a menu title.
                if (
                  openMenu !== null &&
                  openMenu.label !== label &&
                  (event.pointerType !== "touch" || event.pointerId === titlePressPointerIdRef.current)
                ) {
                  playHoverSound();
                  openMenuAt(label, event.currentTarget, { isPointerHeld: event.buttons > 0 });
                }
              }}
            />
            {openMenu?.label === label && (
              <Menu
                items={items}
                opener={{ kind: "title", title: openMenu.anchor, labelledBy: `${titleIdPrefix}-${menuIndex}` }}
                isPointerHeld={openMenu.isPointerHeld}
                focusesFirstItem={openMenu.focusesFirstItem}
                onOpenAdjacentMenu={(direction) => openAdjacentMenu(label, direction)}
                onClose={() => closeMenu(label)}
              />
            )}
          </div>
        ))}
      </nav>
      <div className={styles.spacer} />
      <div className={styles.statusItems}>
        <AppearanceStatus />
        <SoundStatus />
        <TimeStatus />
      </div>
    </header>
  );
}
