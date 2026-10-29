import { THEME_DEFAULTS } from "virtual:theme-defaults";

import { createClientStore } from "../client-store.ts";
import { isOneOf } from "../guards.ts";
import { readStored, removeStored, writeStored } from "../storage.ts";

import { notifyColorChange } from "./color-change.ts";
import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_THEME_COLOR,
  THEME_CHROMA_SCALE_STORAGE_KEY,
  THEME_COLOR_STORAGE_KEY,
  applyAppearance,
  applyThemeTint,
  isAppearanceSetting,
  readStoredThemeTint,
} from "./theme.ts";

import type { AppearanceSetting, ThemeColor } from "./theme.ts";

export { APPEARANCE_SETTINGS } from "./theme.ts";
export type { AppearanceSetting, ThemeColor };

export const SOUND_EFFECTS_SETTINGS = ["on", "off"] as const;

export type SoundEffectsSetting = (typeof SOUND_EFFECTS_SETTINGS)[number];

export interface Settings {
  appearance: AppearanceSetting;
  themeColor: ThemeColor;
  themeChromaScale: number;
  soundEffects: SoundEffectsSetting;
}

export const APPEARANCE_LABELS: Record<AppearanceSetting, string> = { system: "System", light: "Light", dark: "Dark" };
export const THEME_COLOR_LABELS: Record<ThemeColor, string> = {
  purple: "Purple",
  orange: "Orange",
  green: "Green",
  turquoise: "Turquoise",
  red: "Red",
  pink: "Pink",
  blue: "Blue",
};
export const SOUND_EFFECTS_LABELS: Record<SoundEffectsSetting, string> = { on: "On", off: "Off" };

const SOUND_EFFECTS_STORAGE_KEY = "sound";
const SETTINGS_STORAGE_KEYS: ReadonlySet<string> = new Set([
  APPEARANCE_STORAGE_KEY,
  THEME_COLOR_STORAGE_KEY,
  THEME_CHROMA_SCALE_STORAGE_KEY,
  SOUND_EFFECTS_STORAGE_KEY,
]);
const DEFAULT_SETTINGS: Settings = {
  appearance: "system",
  themeColor: DEFAULT_THEME_COLOR,
  themeChromaScale: THEME_DEFAULTS.chromaScale,
  soundEffects: "on",
};

const isSoundEffectsSetting = isOneOf(SOUND_EFFECTS_SETTINGS);

function parseStored<T extends string>(key: string, isValid: (value: string) => value is T, fallback: T): T {
  const rawValue = readStored(key);
  return rawValue !== null && isValid(rawValue) ? rawValue : fallback;
}

function read(): Settings {
  const storedThemeTint = readStoredThemeTint();
  return {
    appearance: parseStored(APPEARANCE_STORAGE_KEY, isAppearanceSetting, DEFAULT_SETTINGS.appearance),
    themeColor: storedThemeTint?.themeColor ?? DEFAULT_SETTINGS.themeColor,
    themeChromaScale: storedThemeTint?.chromaScale ?? DEFAULT_SETTINGS.themeChromaScale,
    soundEffects: parseStored(SOUND_EFFECTS_STORAGE_KEY, isSoundEffectsSetting, DEFAULT_SETTINGS.soundEffects),
  };
}

const { useValue, getValue, setValue } = createClientStore(DEFAULT_SETTINGS, read);

function save<TKey extends keyof Settings>(key: TKey, storageKey: string, value: Settings[TKey]) {
  setValue({ ...getValue(), [key]: value });
  writeStored(storageKey, String(value));
}

export function setAppearance(setting: AppearanceSetting) {
  save("appearance", APPEARANCE_STORAGE_KEY, setting);
  applyAppearance(setting);
  notifyColorChange();
}

export function setThemeColor(themeColor: ThemeColor) {
  save("themeColor", THEME_COLOR_STORAGE_KEY, themeColor);
  applyThemeTint({ themeColor });
  notifyColorChange();
}

export function setThemeChromaScale(chromaScale: number) {
  save("themeChromaScale", THEME_CHROMA_SCALE_STORAGE_KEY, chromaScale);
  applyThemeTint({ chromaScale });
  notifyColorChange();
}

export function setSoundEffects(setting: SoundEffectsSetting) {
  save("soundEffects", SOUND_EFFECTS_STORAGE_KEY, setting);
}

export function resetThemeTint() {
  removeStored(THEME_COLOR_STORAGE_KEY);
  removeStored(THEME_CHROMA_SCALE_STORAGE_KEY);
  setValue({
    ...getValue(),
    themeColor: DEFAULT_SETTINGS.themeColor,
    themeChromaScale: DEFAULT_SETTINGS.themeChromaScale,
  });
  applyThemeTint({ themeColor: null, chromaScale: null });
  notifyColorChange();
}

export function resetSettings() {
  removeStored(APPEARANCE_STORAGE_KEY);
  removeStored(SOUND_EFFECTS_STORAGE_KEY);
  setValue({ ...getValue(), appearance: DEFAULT_SETTINGS.appearance, soundEffects: DEFAULT_SETTINGS.soundEffects });
  applyAppearance(DEFAULT_SETTINGS.appearance);
  resetThemeTint();
}

/** Syncs settings changed in another tab. Returns a function that stops listening. */
export function watchStoredSettings(): () => void {
  const onStorage = (event: StorageEvent) => {
    // `key` is `null` when another tab clears the storage.
    if (event.key !== null && !SETTINGS_STORAGE_KEYS.has(event.key)) {
      return;
    }

    const settings = read();

    setValue(settings);
    applyAppearance(settings.appearance);
    applyThemeTint(readStoredThemeTint() ?? { themeColor: null, chromaScale: null });
    notifyColorChange();
  };

  window.addEventListener("storage", onStorage);

  return () => window.removeEventListener("storage", onStorage);
}

export const useSettings = useValue;

/** The current settings, outside React. Use `useSettings` in a component. */
export const getSettings = getValue;
