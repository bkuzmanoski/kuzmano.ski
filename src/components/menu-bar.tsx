import clsx from "clsx";
import { useRef, useState } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import { DESTINATIONS, DESTINATION_GROUPS, DESTINATION_ORDER } from "#/config/navigation";
import type { DestinationId } from "#/config/navigation";
import { SITE_SOURCE_URL } from "#/config/site";
import { playClick } from "#/lib/audio/ui";
import { useGlobalShortcuts } from "#/lib/hooks/use-global-shortcuts";
import { useIsBootSequenceComplete } from "#/lib/hooks/use-is-boot-sequence-complete";
import { cycle } from "#/lib/math";
import { useFocusedWindow, useWindowActions } from "#/lib/window-manager";

import { restart } from "./boot-sequence";
import { Menu } from "./menu";
import styles from "./menu-bar.module.css";
import { OrganizeWindowsStatus, SoundStatus, ThemeStatus, TimeStatus } from "./status-item";
import { Tooltip } from "./tooltip";

import type { MenuItem } from "./menu";
import type { KeyboardEvent, PointerEvent } from "react";

export function MenuBar() {
  const { open, close } = useWindowActions();
  const focusedPath = useFocusedWindow();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const [openMenu, setOpenMenu] = useState<{ label: string; anchor: HTMLButtonElement } | null>(null);
  const [isPointerHeld, setIsPointerHeld] = useState(false);
  const titles = useRef<Record<string, HTMLButtonElement | null>>({});

  const hasWindow = focusedPath !== null;

  const destinationShortcut = (id: DestinationId) => {
    const number = DESTINATION_ORDER.indexOf(id) + 1;
    return { code: `Digit${number}`, label: String(number) };
  };

  const closeWindow = () => focusedPath && close(focusedPath);

  const menus: Array<{ label: string; items: Array<MenuItem> }> = [
    {
      label: "File",
      items: [
        {
          kind: "action",
          label: "Close",
          shortcut: { code: "KeyW", label: "W" },
          disabled: !hasWindow,
          action: closeWindow,
        },
      ],
    },
    {
      label: "Go",
      items: [
        ...DESTINATION_GROUPS.flatMap((group, index): Array<MenuItem> => [
          ...(index > 0 ? [{ kind: "separator" } as const] : []),
          ...group.map((id): MenuItem => ({
            kind: "action",
            label: DESTINATIONS[id].title,
            shortcut: destinationShortcut(id),
            action: () => open(DESTINATIONS[id].route),
          })),
        ]),
      ],
    },
    {
      label: "Special",
      items: [
        {
          kind: "action",
          label: "View Source",
          accessory: "external-link",
          action: () => window.open(SITE_SOURCE_URL, "_blank"),
        },
        { kind: "separator" },
        { kind: "action", label: "Restart", action: restart },
      ],
    },
  ];

  useGlobalShortcuts([
    { code: "KeyW", run: closeWindow, enabled: hasWindow },
    ...DESTINATION_ORDER.map((id) => ({ code: destinationShortcut(id).code, run: () => open(DESTINATIONS[id].route) })),
  ]);

  /* The arrow keys move along the menu bar whether or not a menu is open. If a menu
   * is open, the adjacent menu opens in its place and takes the focus as it mounts.
   * If none is open, only the focus moves. */
  function moveAlongMenuBar(from: string, direction: 1 | -1) {
    const index = menus.findIndex((menu) => menu.label === from);
    const label = menus[cycle(menus.length, index, direction)]!.label;
    const anchor = titles.current[label];

    if (!anchor) {
      return;
    }

    if (openMenu) {
      setIsPointerHeld(false);
      setOpenMenu({ label, anchor });
    } else {
      anchor.focus();
    }
  }

  /* The handler focuses the title because the markup below prevents the focus the
   * browser sets on mousedown. The default runs after the menu has mounted and has
   * taken the focus which would move the focus back to the title preventing the
   * arrow keys from working. */
  function onTitlePointerDown(event: PointerEvent<HTMLButtonElement>, label: string) {
    const anchor = event.currentTarget;

    playClick();
    anchor.focus();
    setIsPointerHeld(true);
    setOpenMenu((current) => (current?.label === label ? null : { label, anchor }));
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLButtonElement>, label: string) {
    switch (event.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
        event.preventDefault();
        playClick();
        setIsPointerHeld(false);
        setOpenMenu({ label, anchor: event.currentTarget });

        break;
      case "ArrowRight":
        event.preventDefault();
        moveAlongMenuBar(label, 1);

        break;
      case "ArrowLeft":
        event.preventDefault();
        moveAlongMenuBar(label, -1);

        break;
    }
  }

  return (
    <div className={clsx(styles.menuBar, isBootSequenceComplete && styles.ready)}>
      <Tooltip label="About">
        <button
          aria-label={DESTINATIONS.about.title}
          className={styles.logo}
          type="button"
          onClick={() => open(DESTINATIONS.about.route)}
          onPointerDown={playClick}
        >
          <LogoIcon className={styles.logoIcon} />
        </button>
      </Tooltip>

      <nav className={styles.menus} aria-label="Main menu">
        {menus.map(({ label, items }) => (
          <div key={label} className={styles.menu}>
            <button
              ref={(node) => {
                titles.current[label] = node;
              }}
              aria-expanded={openMenu?.label === label}
              aria-haspopup="menu"
              className={clsx(styles.title, openMenu?.label === label && styles.open)}
              type="button"
              onKeyDown={(event) => onTitleKeyDown(event, label)}
              onMouseDown={(event) => event.preventDefault()}
              onPointerDown={(event) => onTitlePointerDown(event, label)}
              onPointerEnter={(event) => {
                if (openMenu !== null && openMenu.label !== label) {
                  setIsPointerHeld(event.buttons > 0);
                  setOpenMenu({ label, anchor: event.currentTarget });
                }
              }}
            >
              {label}
            </button>
            {openMenu?.label === label && (
              <Menu
                anchor={openMenu.anchor}
                items={items}
                isPointerHeld={isPointerHeld}
                onOpenAdjacent={(direction) => moveAlongMenuBar(label, direction)}
                onClose={() => setOpenMenu(null)}
              />
            )}
          </div>
        ))}
      </nav>
      <div className={styles.spacer} />
      <div className={styles.statusItems}>
        <OrganizeWindowsStatus />
        <ThemeStatus />
        <SoundStatus />
        <TimeStatus />
      </div>
    </div>
  );
}
