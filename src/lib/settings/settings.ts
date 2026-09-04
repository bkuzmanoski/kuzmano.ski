import { createClientStore } from "../client-store.ts";
import { readStored, writeStored } from "../storage.ts";

import { THEME_STORAGE_KEY, applyTheme, isThemeSetting } from "./theme.ts";

import type { ThemeSetting } from "./theme.ts";

export type { ThemeSetting as Theme };

export type SoundEffectsSetting = "on" | "off";

export interface Settings {
  theme: ThemeSetting;
  soundEffects: SoundEffectsSetting;
}

const SOUND_EFFECTS_STORAGE_KEY = "sound";

const DEFAULTS: Settings = { theme: "system", soundEffects: "on" };

const isSoundEffectsSetting = (value: string): value is SoundEffectsSetting => value === "off" || value === "on";

function parseStored<T extends string>(key: string, isValid: (value: string) => value is T, fallback: T): T {
  const rawValue = readStored(key);
  return rawValue !== null && isValid(rawValue) ? rawValue : fallback;
}

function read(): Settings {
  return {
    theme: parseStored(THEME_STORAGE_KEY, isThemeSetting, DEFAULTS.theme),
    soundEffects: parseStored(SOUND_EFFECTS_STORAGE_KEY, isSoundEffectsSetting, DEFAULTS.soundEffects),
  };
}

const { useValue, getValue, setValue } = createClientStore(DEFAULTS, read);

function save<TKey extends keyof Settings>(key: TKey, storageKey: string, value: Settings[TKey]) {
  setValue({ ...getValue(), [key]: value });
  writeStored(storageKey, value);
}

export function setTheme(setting: ThemeSetting) {
  save("theme", THEME_STORAGE_KEY, setting);
  applyTheme(setting);
}

export function setSoundEffects(setting: SoundEffectsSetting) {
  save("soundEffects", SOUND_EFFECTS_STORAGE_KEY, setting);
}

export const useSettings = useValue;

/** The current settings, outside React. Use `useSettings` in a component. */
export const getSettings = getValue;
