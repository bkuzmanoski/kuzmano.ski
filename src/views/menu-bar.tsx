import { useEffect, useRef, useState } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import OrganizeIcon from "#/assets/images/organize-windows.svg?react";
import SoundOffIcon from "#/assets/images/sound-effects-off.svg?react";
import SoundOnIcon from "#/assets/images/sound-effects-on.svg?react";
import ThemeLightDarkIcon from "#/assets/images/toggle-theme-lightdark.svg?react";
import ThemeSystemIcon from "#/assets/images/toggle-theme-system.svg?react";
import { Menu } from "#/components/menu";
import type { MenuItem } from "#/components/menu";
import { Tooltip } from "#/components/tooltip";
import { DESTINATIONS, DESTINATION_GROUPS, DESTINATION_ORDER } from "#/config/navigation";
import type { DestinationId } from "#/config/navigation";
import { SITE_SOURCE_URL } from "#/config/site";
import { playClick } from "#/lib/audio/sounds";
import { restart } from "#/lib/boot-sequence/lifecycle";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/use-is-boot-sequence-complete";
import { cx } from "#/lib/class-names";
import { useGlobalShortcuts } from "#/lib/hooks/use-global-shortcuts";
import { cycle } from "#/lib/math";
import { sleep } from "#/lib/screensaver/lifecycle";
import { setSound, setTheme, useSettings } from "#/lib/settings";
import type { Theme } from "#/lib/settings";
import { useFocusedWindow, useWindowActions } from "#/lib/window-manager";

import styles from "./menu-bar.module.css";

import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

const destinationShortcut = (id: DestinationId) => {
  const number = DESTINATION_ORDER.indexOf(id) + 1;
  return { code: `Digit${number}`, label: String(number) };
};

function StatusButton({
  label,
  persistTooltipOnPress,
  className,
  onClick,
  children,
}: {
  label: string;
  persistTooltipOnPress?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label} persistOnPress={persistTooltipOnPress} className={styles.statusItemTooltipWrapper}>
      <button
        type="button"
        aria-label={label}
        className={cx(styles.control, className)}
        onClick={onClick}
        onPointerDown={playClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function OrganizeWindowsStatus() {
  const { organize } = useWindowActions();

  return (
    <StatusButton label="Organize Windows" className={styles.wideOnly} onClick={organize}>
      <OrganizeIcon className={styles.icon} />
    </StatusButton>
  );
}

const THEME_ORDER: Array<Theme> = ["system", "light", "dark"];
const THEME_LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

export function ThemeStatus() {
  const { theme } = useSettings();
  const next = THEME_ORDER[cycle(THEME_ORDER.length, THEME_ORDER.indexOf(theme), 1)]!;
  const Icon = theme === "system" ? ThemeSystemIcon : ThemeLightDarkIcon;

  return (
    <StatusButton label={`Appearance: ${THEME_LABEL[theme]}`} persistTooltipOnPress onClick={() => setTheme(next)}>
      <Icon className={styles.icon} />
    </StatusButton>
  );
}

export function SoundStatus() {
  const { sound } = useSettings();
  const Icon = sound === "on" ? SoundOnIcon : SoundOffIcon;

  return (
    <StatusButton
      label={`Sound: ${sound === "on" ? "On" : "Off"}`}
      persistTooltipOnPress
      onClick={() => {
        setSound(sound === "on" ? "off" : "on");

        // Switching on: the press itself was gated by the setting it just changed.
        if (sound === "off") {
          playClick();
        }
      }}
    >
      <Icon className={styles.icon} />
    </StatusButton>
  );
}

const TIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

function sydneyTime(): string {
  const parts = TIME_FORMAT.formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return `${value("hour")}:${value("minute")} ${value("dayPeriod")} (${value("timeZoneName")})`;
}

export function TimeStatus() {
  const [time, setTime] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      setTime(sydneyTime());

      const now = new Date();
      const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

      timer = setTimeout(tick, msToNextMinute);
    };

    tick();

    return () => clearTimeout(timer);
  }, []);

  if (!time) {
    return null;
  }

  return (
    <Tooltip label="Sydney, Australia">
      <time className={cx(styles.control, styles.time, styles.wideOnly)}>{time}</time>
    </Tooltip>
  );
}

export function MenuBar() {
  const { open, close, cycleWindows } = useWindowActions();
  const focusedWindow = useFocusedWindow();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const [openMenu, setOpenMenu] = useState<{ label: string; anchor: HTMLButtonElement } | null>(null);
  const [isPointerHeld, setIsPointerHeld] = useState(false);
  const titles = useRef<Record<string, HTMLButtonElement | null>>({});

  const hasWindow = focusedWindow !== null;

  const closeWindow = () => focusedWindow && close(focusedWindow);

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
            href: DESTINATIONS[id].route,
            action: () => open(DESTINATIONS[id].route),
          })),
        ]),
      ],
    },
    {
      label: "Special",
      items: [
        { kind: "action", label: "View Source", accessory: "external-link", href: SITE_SOURCE_URL, target: "_blank" },
        { kind: "separator" },
        { kind: "action", label: "Sleep", action: sleep },
        { kind: "action", label: "Restart", action: restart },
      ],
    },
  ];

  useGlobalShortcuts([
    { code: "KeyW", run: closeWindow, enabled: hasWindow },
    { code: "Tab", run: cycleWindows, runsWhileEditing: true },
    ...DESTINATION_ORDER.map((id) => ({ code: destinationShortcut(id).code, run: () => open(DESTINATIONS[id].route) })),
  ]);

  function openMenuAt(label: string, anchor: HTMLButtonElement, { pointerHeld = false } = {}) {
    setIsPointerHeld(pointerHeld);
    setOpenMenu({ label, anchor });
  }

  // On touch, the press that dismisses an open menu can also open the next menu.
  // There is no hover to switch menus first, so the new menu replaces the old one
  // before its outside-press handler runs. Closing by label leaves the replacement open.
  function closeMenu(label: string) {
    setOpenMenu((current) => (current?.label === label ? null : current));
  }

  // Arrow keys always move along the menu bar. With a menu open, the adjacent menu
  // replaces it and receives focus; otherwise only the title receives focus.
  function moveAlongMenuBar(from: string, direction: 1 | -1) {
    const index = menus.findIndex((menu) => menu.label === from);
    const label = menus[cycle(menus.length, index, direction)]!.label;
    const anchor = titles.current[label];

    if (!anchor) {
      return;
    }

    if (openMenu) {
      openMenuAt(label, anchor);
    } else {
      anchor.focus();
    }
  }

  // The browser's mousedown focus is prevented by the markup below. The menu mounts and
  // focuses itself, so the default focus action must be delayed until after that focus;
  // otherwise it steals focus back from the menu and arrow-key navigation stops.
  //
  // Touch input is implicitly captured by the title it lands on, so other titles never
  // receive `pointerenter` while the finger is held. Releasing the capture lets the
  // pointer move between titles and change the open menu like a held mouse.
  function onTitlePointerDown(event: PointerEvent<HTMLButtonElement>, label: string) {
    const anchor = event.currentTarget;

    if (anchor.hasPointerCapture(event.pointerId)) {
      anchor.releasePointerCapture(event.pointerId);
    }

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
        openMenuAt(label, event.currentTarget);

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
    <div className={cx(styles.menuBar, isBootSequenceComplete && styles.ready)}>
      <div className={styles.logo}>
        <LogoIcon className={styles.logoIcon} />
      </div>
      <nav className={styles.menus} aria-label="Main menu">
        {menus.map(({ label, items }) => (
          <div key={label} className={styles.item}>
            <button
              ref={(node) => {
                titles.current[label] = node;
              }}
              type="button"
              className={cx(styles.title, openMenu?.label === label && styles.open)}
              aria-expanded={openMenu?.label === label}
              aria-haspopup="menu"
              onKeyDown={(event) => onTitleKeyDown(event, label)}
              onMouseDown={(event) => event.preventDefault()}
              onPointerDown={(event) => onTitlePointerDown(event, label)}
              onPointerEnter={(event) => {
                if (openMenu !== null && openMenu.label !== label) {
                  openMenuAt(label, event.currentTarget, { pointerHeld: event.buttons > 0 });
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
                onClose={() => closeMenu(label)}
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
