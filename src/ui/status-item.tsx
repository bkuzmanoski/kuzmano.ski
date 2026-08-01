import { useEffect, useState } from "react";

import OrganizeIcon from "#/assets/images/organize-windows.svg?react";
import SoundOffIcon from "#/assets/images/sound-effects-off.svg?react";
import SoundOnIcon from "#/assets/images/sound-effects-on.svg?react";
import ThemeLightDarkIcon from "#/assets/images/toggle-theme-lightdark.svg?react";
import ThemeSystemIcon from "#/assets/images/toggle-theme-system.svg?react";
import { setSound, setTheme, useSettings } from "#/lib/settings";
import type { Theme } from "#/lib/settings";
import { useWindowActions } from "#/lib/window-manager";

import styles from "./status-item.module.css";
import { Tooltip } from "./tooltip";

import type { ReactNode } from "react";

function StatusButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip label={label}>
      <button aria-label={label} className={styles.control} type="button" onClick={onClick}>
        {children}
      </button>
    </Tooltip>
  );
}

export function OrganizeWindowsStatus() {
  const { organize } = useWindowActions();

  return (
    <StatusButton label="Organize Windows" onClick={organize}>
      <OrganizeIcon className={styles.icon} />
    </StatusButton>
  );
}

const THEME_ORDER: Array<Theme> = ["system", "light", "dark"];
const THEME_LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };

export function ThemeStatus() {
  const { theme } = useSettings();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]!;
  const Icon = theme === "system" ? ThemeSystemIcon : ThemeLightDarkIcon;

  return (
    <StatusButton label={`Appearance: ${THEME_LABEL[theme]}`} onClick={() => setTheme(next)}>
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
      onClick={() => setSound(sound === "on" ? "off" : "on")}
    >
      <Icon className={styles.icon} />
    </StatusButton>
  );
}

function sydneyTime(): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(new Date());

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
    return <span className={styles.time} aria-hidden />;
  }

  return (
    <Tooltip label="Sydney, Australia">
      <time className={styles.time}>{time}</time>
    </Tooltip>
  );
}
