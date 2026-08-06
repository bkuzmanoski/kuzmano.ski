import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY, applyTheme, isTheme } from "#/lib/theme";
import type { Theme } from "#/lib/theme";

export type { Theme };

export type Sound = "on" | "off";

export interface Settings {
  theme: Theme;
  sound: Sound;
}

const SOUND_STORAGE_KEY = "sound";

const DEFAULTS: Settings = { theme: "system", sound: "on" };

const isSound = (value: string): value is Sound => value === "off" || value === "on";

function parseStored<T extends string>(key: string, isValid: (value: string) => value is T, fallback: T): T {
  const rawValue = localStorage.getItem(key);
  return rawValue !== null && isValid(rawValue) ? rawValue : fallback;
}

function read(): Settings {
  try {
    return {
      theme: parseStored(THEME_STORAGE_KEY, isTheme, DEFAULTS.theme),
      sound: parseStored(SOUND_STORAGE_KEY, isSound, DEFAULTS.sound),
    };
  } catch {
    return DEFAULTS;
  }
}

let state: Settings = typeof window === "undefined" ? DEFAULTS : read();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function setTheme(theme: Theme) {
  state = { ...state, theme };

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignored.
  }

  applyTheme(theme);
  emit();
}

export function setSound(sound: Sound) {
  state = { ...state, sound };

  try {
    localStorage.setItem(SOUND_STORAGE_KEY, sound);
  } catch {
    // Ignored.
  }

  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => DEFAULTS;

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The current settings, outside React. Use `useSettings` in a component. */
export function getSettings(): Settings {
  return state;
}
