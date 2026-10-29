import { useEffect, useId, useRef, useState } from "react";

import Logo from "#/assets/images/logo.svg?react";
import SoundEffectsOffMenuBarIcon from "#/assets/images/menu-bar-icon-sound-effects-off.svg?react";
import SoundEffectsOnMenuBarIcon from "#/assets/images/menu-bar-icon-sound-effects-on.svg?react";
import ToggleAppearanceLightDarkMenuBarIcon from "#/assets/images/menu-bar-icon-toggle-appearance-light-dark.svg?react";
import ToggleAppearanceSystemMenuBarIcon from "#/assets/images/menu-bar-icon-toggle-appearance-system.svg?react";
import { Tooltip } from "#/components/tooltip.tsx";
import { FEATURE_ROUTE_SPECS } from "#/config/feature-routes.ts";
import { DESTINATION_GROUPS, DESTINATION_ORDER } from "#/config/navigation.ts";
import type { DestinationId } from "#/config/navigation.ts";
import { SITE_LOCALE, SITE_LOCATION, SITE_NAME, SITE_SOURCE_URL, SITE_TIME_ZONE } from "#/config/site.ts";
import { setSoundEffectsAudibly } from "#/lib/audio/sound-effects-setting.ts";
import { playClickSound, playHoverSound } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { cx } from "#/lib/class-names.ts";
import { useGlobalShortcuts } from "#/lib/hooks/use-global-shortcuts.ts";
import type { KeyboardShortcut } from "#/lib/hooks/use-global-shortcuts.ts";
import { useTimer } from "#/lib/hooks/use-timer.ts";
import { cycle } from "#/lib/math.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { isPrimaryPress } from "#/lib/press.ts";
import { sleep } from "#/lib/screensaver/lifecycle.ts";
import {
  APPEARANCE_LABELS,
  APPEARANCE_SETTINGS,
  SOUND_EFFECTS_LABELS,
  setAppearance,
  useSettings,
} from "#/lib/settings/settings.ts";
import { restart, useIsStartupSequenceComplete } from "#/lib/startup-sequence/lifecycle.ts";
import { STATE_DISPLAY_DURATION_MS } from "#/lib/tooltip.ts";
import { useFocusedWindow, useWindowActions, useWindowContent } from "#/lib/window-manager/context.ts";
import { SITE_FEED } from "#/site/feeds.ts";
import { DESTINATIONS } from "#/site/navigation.ts";
import { isFeatureWindow, windowAlternateRepresentationsOf } from "#/site/windows.ts";

import styles from "./menu-bar.module.css";
import { joinedWithSeparators } from "./menu-items.ts";
import { Menu } from "./menu.tsx";

import type { MenuItem } from "./menu-items.ts";
import type { ComponentType, KeyboardEvent, PointerEvent, ReactNode } from "react";

const destinationShortcut = (id: DestinationId) => {
  const shortcutNumber = DESTINATION_ORDER.indexOf(id) + 1;
  return { code: `Digit${shortcutNumber}`, label: String(shortcutNumber) };
};

function StatusButton({
  label,
  className,
  isSilent = false,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  isSilent?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [isShowingState, setIsShowingState] = useState(false);
  const timer = useTimer();
  const pressSoundHandlers = usePressSound();

  function showState() {
    setIsShowingState(true);
    timer.start(() => setIsShowingState(false), STATE_DISPLAY_DURATION_MS);
  }

  function clearState() {
    timer.cancel();
    setIsShowingState(false);
  }

  return (
    <Tooltip
      label={label}
      persistOnPress
      showsState={isShowingState}
      onDidHide={clearState}
      className={cx(styles.statusItemTooltipWrapper, className)}
    >
      <button
        type="button"
        className={styles.control}
        aria-label={label}
        {...mergeHandlers(isSilent ? {} : pressSoundHandlers, {
          onClick: () => {
            showState();
            onClick();
          },
        })}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function AppearanceStatus() {
  const { appearance } = useSettings();
  const nextAppearance =
    APPEARANCE_SETTINGS[cycle(APPEARANCE_SETTINGS.length, APPEARANCE_SETTINGS.indexOf(appearance), 1)]!;
  const Icon = appearance === "system" ? ToggleAppearanceSystemMenuBarIcon : ToggleAppearanceLightDarkMenuBarIcon;

  return (
    <StatusButton
      label={`Appearance: ${APPEARANCE_LABELS[appearance]}`}
      className={styles.appearanceStatus}
      onClick={() => setAppearance(nextAppearance)}
    >
      <Icon className={styles.menuBarIcon} />
    </StatusButton>
  );
}

function SoundStatus() {
  const { soundEffects: sound } = useSettings();
  const Icon = sound === "on" ? SoundEffectsOnMenuBarIcon : SoundEffectsOffMenuBarIcon;

  return (
    <StatusButton
      label={`Sound: ${SOUND_EFFECTS_LABELS[sound]}`}
      isSilent={sound === "on"}
      onClick={() => setSoundEffectsAudibly(sound === "on" ? "off" : "on")}
    >
      <Icon className={styles.menuBarIcon} />
    </StatusButton>
  );
}

interface SiteTime {
  dateTime: string; // The displayed minute as a valid global date and time string, in UTC.
  timeText: string; // The hour, minute, and day period, without the time zone.
  timeZoneName: string;
}

const TIME_FORMAT = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: SITE_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

function currentSiteTime(): SiteTime {
  const now = new Date();
  const timeParts = TIME_FORMAT.formatToParts(now);

  const partValue = (type: string) => timeParts.find((part) => part.type === type)?.value ?? "";

  return {
    dateTime: `${now.toISOString().slice(0, "YYYY-MM-DDTHH:MM".length)}Z`,
    timeText: `${partValue("hour")}:${partValue("minute")} ${partValue("dayPeriod")}`,
    timeZoneName: partValue("timeZoneName"),
  };
}

function TimeStatus() {
  const [clockTime, setClockTime] = useState<SiteTime | null>(null);

  useEffect(() => {
    let tickTimer: ReturnType<typeof setTimeout>;

    const tick = () => {
      setClockTime(currentSiteTime());

      const now = new Date();
      const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

      tickTimer = setTimeout(tick, msToNextMinute);
    };

    tick();

    return () => clearTimeout(tickTimer);
  }, []);

  if (!clockTime) {
    return null;
  }

  return (
    <Tooltip label={SITE_LOCATION} childTextIncludesLabel>
      <time dateTime={clockTime.dateTime} className={cx(styles.control, styles.time, styles.wideOnly)}>
        <span>
          {clockTime.timeText}
          {/* Hidden from assistive technology, which reads the location instead of an abbreviation that VoiceOver pronounces as a word. */}
          <span aria-hidden>{` (${clockTime.timeZoneName})`}</span>
          {/* One text node, so a screen reader reads the location as one phrase. */}
          <span className={styles.timeLocation}>{` in ${SITE_LOCATION}`}</span>
        </span>
      </time>
    </Tooltip>
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
    focusesFirstItem: boolean;
  } | null>(null);
  const titleIdPrefix = useId();
  const [isPointerHeld, setIsPointerHeld] = useState(false);
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
    { label: "View as Markdown", href: alternateRepresentations?.markdownRepresentationPath },
    { label: "Atom Feed", href: feed?.path },
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
    { pointerHeld = false, focusesFirstItem = false } = {},
  ) {
    setIsPointerHeld(pointerHeld);
    setOpenMenu({ label, anchor, focusesFirstItem });
  }

  // On touch, the press that dismisses an open menu can also open the next menu.
  // There is no hover to switch menus first, so the new menu replaces the old one
  // before its outside-press handler runs. Closing by label leaves the replacement open.
  function closeMenu(label: string) {
    setOpenMenu((current) => (current?.label === label ? null : current));
  }

  // Arrow keys always move along the menu bar. With a menu open, the adjacent menu
  // replaces it and receives focus; otherwise only the title receives focus.
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

  // The browser's mousedown focus is prevented by the markup below. The menu mounts and
  // focuses itself, so the default focus action must be delayed until after that focus;
  // otherwise it steals focus back from the menu and arrow-key navigation stops.
  //
  // Touch input is implicitly captured by the title it lands on, so other titles never
  // receive `pointerenter` while the finger is held. Releasing the capture lets the
  // pointer move between titles and change the open menu like a held mouse.
  function onTitlePointerDown(event: PointerEvent<HTMLButtonElement>, label: string) {
    if (!isPrimaryPress(event)) {
      return;
    }

    const anchor = event.currentTarget;

    titlePressPointerIdRef.current = event.pointerId;

    if (anchor.hasPointerCapture(event.pointerId)) {
      anchor.releasePointerCapture(event.pointerId);
    }

    playClickSound();
    anchor.focus({ focusVisible: false });
    setIsPointerHeld(true);
    setOpenMenu((current) => (current?.label === label ? null : { label, anchor, focusesFirstItem: false }));
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
            <button
              ref={(node) => {
                titleElementsRef.current[label] = node;
              }}
              id={`${titleIdPrefix}-${menuIndex}`}
              type="button"
              className={cx(styles.title, openMenu?.label === label && styles.open)}
              aria-label={Icon ? label : undefined}
              aria-expanded={openMenu?.label === label}
              aria-haspopup="menu"
              onKeyDown={(event) => onTitleKeyDown(event, label)}
              onMouseDown={(event) => event.preventDefault()}
              onPointerDown={(event) => onTitlePointerDown(event, label)}
              onPointerEnter={(event) => {
                // Touch emits `pointerenter` before `pointerdown`; ignore it unless it belongs to a touch drag
                // that began on a menu title, preventing the newly opened menu from immediately closing.
                if (
                  openMenu !== null &&
                  openMenu.label !== label &&
                  (event.pointerType !== "touch" || event.pointerId === titlePressPointerIdRef.current)
                ) {
                  playHoverSound();
                  openMenuAt(label, event.currentTarget, { pointerHeld: event.buttons > 0 });
                }
              }}
            >
              {Icon ? <Icon className={styles.titleIcon} /> : label}
            </button>
            {openMenu?.label === label && (
              <Menu
                anchor={openMenu.anchor}
                labelledBy={`${titleIdPrefix}-${menuIndex}`}
                items={items}
                isPointerHeld={isPointerHeld}
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
