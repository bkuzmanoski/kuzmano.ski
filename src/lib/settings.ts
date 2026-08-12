import { createClientStore } from "./client-store";
import { readStored, writeStored } from "./storage";
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

const { useValue, getValue, setValue } = createClientStore(DEFAULTS, read);

function save<TKey extends keyof Settings>(key: TKey, storageKey: string, value: Settings[TKey]) {
  setValue({ ...getValue(), [key]: value });
  writeStored(storageKey, value);
}

export function setTheme(theme: Theme) {
  save("theme", THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export function setSound(sound: Sound) {
  save("sound", SOUND_STORAGE_KEY, sound);
}

export const useSettings = useValue;

/** The current settings, outside React. Use `useSettings` in a component. */
export const getSettings = getValue;
