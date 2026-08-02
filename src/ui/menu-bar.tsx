import clsx from "clsx";
import { useRef, useState } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import { DESTINATIONS, DESTINATION_ORDER } from "#/config/navigation";
import { RESUME_URL, SITE_SOURCE_URL } from "#/config/site";
import { downloadFile } from "#/lib/download";
import { useGlobalShortcuts } from "#/lib/hooks/use-global-shortcuts";
import { useHasBooted } from "#/lib/hooks/use-has-booted";
import { cycle } from "#/lib/math";
import { playClick } from "#/lib/sound";
import { useFocusedWindow, useWindowActions } from "#/lib/window-manager";

import { restart } from "./boot-overlay";
import { Menu } from "./menu";
import styles from "./menu-bar.module.css";
import { OrganizeWindowsStatus, SoundStatus, ThemeStatus, TimeStatus } from "./status-item";
import { Tooltip } from "./tooltip";

import type { MenuItem } from "./menu";
import type { KeyboardEvent } from "react";

export function MenuBar() {
  const { open, close } = useWindowActions();
  const focusedPath = useFocusedWindow();
  const hasBooted = useHasBooted();
  const [openMenu, setOpenMenu] = useState<{ label: string; anchor: HTMLButtonElement } | null>(null);
  const [isPointerHeld, setIsPointerHeld] = useState(false);
  const titles = useRef<Record<string, HTMLButtonElement | null>>({});

  const hasWindow = focusedPath !== null;

  const destinationShortcuts = DESTINATION_ORDER.map((id, index) => ({
    code: `Digit${index + 1}`,
    label: String(index + 1),
    destination: DESTINATIONS[id],
  }));

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
          trigger: closeWindow,
        },
      ],
    },
    {
      label: "Go",
      items: [
        ...destinationShortcuts.map(({ code, label, destination }): MenuItem => ({
          kind: "action",
          label: destination.label,
          shortcut: { code, label },
          trigger: () => open(destination.route),
        })),
        { kind: "separator" },
        { kind: "action", label: "Résumé (PDF)", accessory: "download", trigger: () => downloadFile(RESUME_URL) },
      ],
    },
    {
      label: "Special",
      items: [
        {
          kind: "action",
          label: "View Source",
          accessory: "external-link",
          trigger: () => window.open(SITE_SOURCE_URL, "_blank"),
        },
        { kind: "separator" },
        { kind: "action", label: "Restart", trigger: restart },
      ],
    },
  ];

  useGlobalShortcuts([
    { code: "KeyW", run: closeWindow, enabled: hasWindow },
    ...destinationShortcuts.map(({ code, destination }) => ({ code, run: () => open(destination.route) })),
  ]);

  function focusAdjacentMenu(from: string, direction: 1 | -1) {
    const index = menus.findIndex((menu) => menu.label === from);
    const next = menus[cycle(menus.length, index, direction)]!.label;
    const anchor = titles.current[next];

    anchor?.focus();

    if (openMenu && anchor) {
      setIsPointerHeld(false);
      setOpenMenu({ label: next, anchor });
    }
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
        focusAdjacentMenu(label, 1);

        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAdjacentMenu(label, -1);

        break;
      case "Escape":
        setOpenMenu(null);
        break;
    }
  }

  return (
    <div className={clsx(styles.menuBar, hasBooted && styles.ready)}>
      <Tooltip label="About">
        <button
          aria-label={DESTINATIONS.about.label}
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
              className={clsx(styles.title, openMenu?.label === label && styles.titleOpen)}
              type="button"
              onKeyDown={(event) => onTitleKeyDown(event, label)}
              onPointerDown={(event) => {
                const anchor = event.currentTarget;

                playClick();
                setIsPointerHeld(true);
                setOpenMenu((current) => (current?.label === label ? null : { label, anchor }));
              }}
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
