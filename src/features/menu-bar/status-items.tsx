import { useEffect, useState } from "react";

import SoundEffectsOffMenuBarIcon from "#/assets/images/menu-bar-icon-sound-effects-off.svg?react";
import SoundEffectsOnMenuBarIcon from "#/assets/images/menu-bar-icon-sound-effects-on.svg?react";
import ToggleAppearanceLightDarkMenuBarIcon from "#/assets/images/menu-bar-icon-toggle-appearance-light-dark.svg?react";
import ToggleAppearanceSystemMenuBarIcon from "#/assets/images/menu-bar-icon-toggle-appearance-system.svg?react";
import { Tooltip } from "#/components/tooltip.tsx";
import { SITE_LOCALE, SITE_LOCATION, SITE_TIME_ZONE } from "#/config/site.ts";
import { setSoundEffectsAudibly } from "#/lib/audio/sound-effects-setting.ts";
import { cx } from "#/lib/class-names.ts";
import { useTimer } from "#/lib/hooks/use-timer.ts";
import { cycle } from "#/lib/math.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { usePressSound } from "#/lib/press/use-press-sound.ts";
import {
  APPEARANCE_LABELS,
  APPEARANCE_SETTINGS,
  SOUND_EFFECTS_LABELS,
  setAppearance,
  useSettings,
} from "#/lib/settings/settings.ts";
import { STATE_DISPLAY_DURATION_MS } from "#/lib/tooltip.ts";

import styles from "./status-items.module.css";

import type { ReactNode } from "react";

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

export function AppearanceStatus() {
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

export function SoundStatus() {
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
  /** The displayed minute as a valid global date and time string, in UTC. */
  dateTime: string;
  /** The hour, minute, and day period, without the time zone. */
  timeText: string;
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

export function TimeStatus() {
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
