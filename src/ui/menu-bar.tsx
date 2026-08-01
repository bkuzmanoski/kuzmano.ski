import clsx from "clsx";
import { useRef, useState } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import { RESUME_URL, SITE_SOURCE_URL } from "#/config/site";
import { downloadFile } from "#/lib/download";
import { useGlobalShortcuts } from "#/lib/keyboard-shortcut";
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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isPointerHeld, setIsPointerHeld] = useState(false);
  const titles = useRef<Record<string, HTMLButtonElement | null>>({});

  const hasWindow = focusedPath !== null;

  const actions = {
    close: () => focusedPath && close(focusedPath),
    techNotes: () => open("/tech-notes"),
    designNotes: () => open("/design-notes"),
    work: () => open("/work"),
    about: () => open("/about"),
    contact: () => open("/contact"),
  };

  const menus: Array<{ label: string; items: Array<MenuItem> }> = [
    {
      label: "File",
      items: [
        {
          kind: "action",
          label: "Close",
          shortcut: { code: "KeyW", label: "W" },
          disabled: !hasWindow,
          trigger: actions.close,
        },
      ],
    },
    {
      label: "Go",
      items: [
        { kind: "action", label: "Tech Notes", shortcut: { code: "Digit1", label: "1" }, trigger: actions.techNotes },
        {
          kind: "action",
          label: "Design Notes",
          shortcut: { code: "Digit2", label: "2" },
          trigger: actions.designNotes,
        },
        { kind: "action", label: "Work", shortcut: { code: "Digit3", label: "3" }, trigger: actions.work },
        { kind: "action", label: "About", shortcut: { code: "Digit4", label: "4" }, trigger: actions.about },
        { kind: "action", label: "Contact", shortcut: { code: "Digit5", label: "5" }, trigger: actions.contact },
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
    { code: "KeyW", run: actions.close, enabled: hasWindow },
    { code: "Digit1", run: actions.techNotes },
    { code: "Digit2", run: actions.designNotes },
    { code: "Digit3", run: actions.work },
    { code: "Digit4", run: actions.about },
    { code: "Digit5", run: actions.contact },
  ]);

  function focusAdjacentMenu(from: string, direction: 1 | -1) {
    const index = menus.findIndex((menu) => menu.label === from);
    const next = menus[(index + direction + menus.length) % menus.length]!.label;

    titles.current[next]?.focus();

    if (openMenu) {
      setIsPointerHeld(false);
      setOpenMenu(next);
    }
  }

  function onTitleKeyDown(event: KeyboardEvent, label: string) {
    switch (event.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
        event.preventDefault();
        setIsPointerHeld(false);
        setOpenMenu(label);

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
    <div className={styles.menuBar}>
      <Tooltip label="About">
        <button aria-label="About" className={styles.logo} type="button" onClick={actions.about}>
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
              aria-expanded={openMenu === label}
              aria-haspopup="menu"
              className={clsx(styles.title, openMenu === label && styles.titleOpen)}
              type="button"
              onKeyDown={(event) => onTitleKeyDown(event, label)}
              onPointerDown={() => {
                setIsPointerHeld(true);
                setOpenMenu((current) => (current === label ? null : label));
              }}
              onPointerEnter={(event) => {
                if (openMenu !== null && openMenu !== label) {
                  setIsPointerHeld(event.buttons > 0);
                  setOpenMenu(label);
                }
              }}
            >
              {label}
            </button>
            {openMenu === label && (
              <Menu
                anchor={titles.current[label] ?? null}
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
