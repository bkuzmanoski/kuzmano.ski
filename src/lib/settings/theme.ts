// This module imports only leaf modules so the pre-hydration theme scripts can use it (see `/build/inline-scripts.ts`).
import { ACCENT_COLOR_NAMES } from "../accent-colors.ts";
import { readStored } from "../storage.ts";

import { THEME_CHROMA_SCALE_PROPERTY, THEME_CHROMA_SCALE_RANGE, isSteppedValueIn } from "./theme-tint.ts";

import type { AccentColorName } from "../accent-colors.ts";

export type AppearanceSetting = "system" | "light" | "dark";
export type ThemeColor = AccentColorName;

export const DEFAULT_THEME_COLOR: ThemeColor = "purple";

export type ColorScheme = "light" | "dark";

export const COLOR_SCHEMES: ReadonlyArray<ColorScheme> = ["light", "dark"];

export const APPEARANCE_STORAGE_KEY = "appearance";
export const THEME_COLOR_STORAGE_KEY = "theme-color";
export const THEME_CHROMA_SCALE_STORAGE_KEY = "theme-chroma-scale";

export const desktopBackgroundThemeColorStorageKeyFor = (colorScheme: ColorScheme) =>
  `desktop-background-theme-color-${colorScheme}`;

const APPEARANCE_ATTRIBUTE = "data-appearance";
const THEME_COLOR_ATTRIBUTE = "data-theme-color";

export const THEME_COLOR_SCHEME_ATTRIBUTE = "data-color-scheme";
export const DESKTOP_BACKGROUND_THEME_COLOR_ATTRIBUTE = "data-desktop-background-theme-color";

export const isAppearanceSetting = (value: string): value is AppearanceSetting =>
  value === "system" || value === "light" || value === "dark";

export const isThemeColor = (value: string | null): value is ThemeColor =>
  (ACCENT_COLOR_NAMES as ReadonlyArray<string | null>).includes(value);

export function themeChromaScaleFrom(rawValue: string | null): number | null {
  const value = rawValue?.trim() ? Number(rawValue) : Number.NaN; // `Number` parses an empty or whitespace-only string as `0`.
  return isSteppedValueIn(value, THEME_CHROMA_SCALE_RANGE) ? value : null;
}

export function readStoredThemeTint(): { themeColor: ThemeColor | null; chromaScale: number | null } | null {
  const storedThemeColor = readStored(THEME_COLOR_STORAGE_KEY);
  const themeColor = isThemeColor(storedThemeColor) ? storedThemeColor : null;
  const chromaScale = themeChromaScaleFrom(readStored(THEME_CHROMA_SCALE_STORAGE_KEY));

  return themeColor === null && chromaScale === null ? null : { themeColor, chromaScale };
}

function setRootAttribute(name: string, value: string | null) {
  if (value === null) {
    document.documentElement.removeAttribute(name);
  } else {
    document.documentElement.setAttribute(name, value);
  }
}

export const themeColorMediaFor = (colorScheme: ColorScheme, appearance: AppearanceSetting): string => {
  if (appearance === "system") {
    return `(prefers-color-scheme: ${colorScheme})`;
  }

  return appearance === colorScheme ? "all" : "not all";
};

/**
 * Applies the appearance to `<html>` and to the `media` attribute of each `theme-color` pair. Does not notify the color
 * change listeners (see `notifyColorChange`).
 */
export function applyAppearance(appearance: AppearanceSetting) {
  setRootAttribute(APPEARANCE_ATTRIBUTE, appearance === "system" ? null : appearance);

  for (const meta of document.querySelectorAll<HTMLMetaElement>(`meta[${THEME_COLOR_SCHEME_ATTRIBUTE}]`)) {
    meta.setAttribute(
      "media",
      themeColorMediaFor(meta.getAttribute(THEME_COLOR_SCHEME_ATTRIBUTE) as ColorScheme, appearance),
    );
  }
}

/**
 * Applies the theme color, chroma scale, or both. Pass `null` to reset a value to the stylesheet default, or omit it
 * to leave it unchanged. This does not notify color change listeners (see `notifyColorChange`).
 *
 * Values are set on `<html>` because `:root` uses them to derive neutral and accent colors inherited by descendants.
 */
export function applyThemeTint({
  themeColor,
  chromaScale,
}: {
  themeColor?: ThemeColor | null;
  chromaScale?: number | null;
}) {
  if (themeColor !== undefined) {
    setRootAttribute(THEME_COLOR_ATTRIBUTE, themeColor === DEFAULT_THEME_COLOR ? null : themeColor);
  }

  if (chromaScale === null) {
    document.documentElement.style.removeProperty(THEME_CHROMA_SCALE_PROPERTY);
  } else if (chromaScale !== undefined) {
    document.documentElement.style.setProperty(THEME_CHROMA_SCALE_PROPERTY, String(chromaScale));
  }
}

/** Sets the rendered desktop background `theme-color` for `colorScheme` when `color` is not `null`. */
export function applyDesktopBackgroundThemeColor(colorScheme: ColorScheme, color: string | null) {
  const meta = document.querySelector<HTMLMetaElement>(
    `meta[${DESKTOP_BACKGROUND_THEME_COLOR_ATTRIBUTE}][${THEME_COLOR_SCHEME_ATTRIBUTE}="${colorScheme}"]`,
  );

  if (meta && color !== null) {
    meta.content = color;
  }
}
