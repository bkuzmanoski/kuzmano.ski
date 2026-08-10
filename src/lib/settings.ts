import { useSyncExternalStore } from "react";

import { readStored, writeStored } from "./storage";
import { createEmitter } from "./store";
import { THEME_STORAGE_KEY, applyTheme, isTheme } from "./theme";

import type { Theme } from "./theme";

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
  const rawValue = readStored(key);
  return rawValue !== null && isValid(rawValue) ? rawValue : fallback;
}

function read(): Settings {
  return {
    theme: parseStored(THEME_STORAGE_KEY, isTheme, DEFAULTS.theme),
    sound: parseStored(SOUND_STORAGE_KEY, isSound, DEFAULTS.sound),
  };
}

let state: Settings = typeof window === "undefined" ? DEFAULTS : read();

const { emit, subscribe } = createEmitter();

function save<TKey extends keyof Settings>(key: TKey, storageKey: string, value: Settings[TKey]) {
  state = { ...state, [key]: value };
  writeStored(storageKey, value);
  emit();
}

export function setTheme(theme: Theme) {
  save("theme", THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export function setSound(sound: Sound) {
  save("sound", SOUND_STORAGE_KEY, sound);
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
