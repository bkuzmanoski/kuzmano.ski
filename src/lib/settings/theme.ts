// Imports only leaf modules because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`).
import { ACCENT_COLOR_NAMES } from "../accent-colors.ts";
import { isOneOf } from "../guards.ts";
import { isSteppedValueIn } from "../stepped-range.ts";
import { readStored } from "../storage.ts";

import {
  DEFAULT_THEME_CHROMA_SCALE,
  DEFAULT_THEME_COLOR,
  THEME_CHROMA_SCALE_PROPERTY,
  THEME_CHROMA_SCALE_RANGE,
  themeColorPropertiesOf,
} from "./theme-tint.ts";

import type { AccentColorName } from "../accent-colors.ts";

/** In the order the controls cycle through them. */
export const APPEARANCE_SETTINGS = ["system", "light", "dark"] as const;

export type AppearanceSetting = (typeof APPEARANCE_SETTINGS)[number];
export type ThemeColor = AccentColorName;

export const COLOR_SCHEMES = ["light", "dark"] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];

export const APPEARANCE_STORAGE_KEY = "appearance";
export const THEME_COLOR_STORAGE_KEY = "theme-color";
export const THEME_CHROMA_SCALE_STORAGE_KEY = "theme-chroma-scale";

export const desktopBackgroundThemeColorStorageKeyFor = (colorScheme: ColorScheme) =>
  `desktop-background-theme-color-${colorScheme}`;

const APPEARANCE_ATTRIBUTE = "data-appearance";

export const THEME_COLOR_SCHEME_ATTRIBUTE = "data-color-scheme";
export const DESKTOP_BACKGROUND_THEME_COLOR_ATTRIBUTE = "data-desktop-background-theme-color";

export const isAppearanceSetting = isOneOf(APPEARANCE_SETTINGS);

export function themeChromaScaleFrom(rawValue: string | null): number | null {
  const value = rawValue?.trim() ? Number(rawValue) : Number.NaN; // `Number` parses an empty or whitespace-only string as `0`.
  return isSteppedValueIn(value, THEME_CHROMA_SCALE_RANGE) ? value : null;
}

const isThemeColor = isOneOf(ACCENT_COLOR_NAMES);

export function readStoredThemeTint(): { themeColor: ThemeColor | null; chromaScale: number | null } | null {
  const storedThemeColor = readStored(THEME_COLOR_STORAGE_KEY);
  const themeColor = isThemeColor(storedThemeColor) ? storedThemeColor : null;
  const chromaScale = themeChromaScaleFrom(readStored(THEME_CHROMA_SCALE_STORAGE_KEY));

  return themeColor === null && chromaScale === null ? null : { themeColor, chromaScale };
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
  if (appearance === "system") {
    document.documentElement.removeAttribute(APPEARANCE_ATTRIBUTE);
  } else {
    document.documentElement.setAttribute(APPEARANCE_ATTRIBUTE, appearance);
  }

  for (const meta of document.querySelectorAll<HTMLMetaElement>(`meta[${THEME_COLOR_SCHEME_ATTRIBUTE}]`)) {
    meta.setAttribute(
      "media",
      themeColorMediaFor(meta.getAttribute(THEME_COLOR_SCHEME_ATTRIBUTE) as ColorScheme, appearance),
    );
  }
}

/**
 * Applies the theme color, chroma scale, or both. Pass `null` to reset a value to its default, or omit it to leave it
 * unchanged. This does not notify color change listeners (see `notifyColorChange`).
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
    for (const [property, value] of Object.entries(themeColorPropertiesOf(themeColor ?? DEFAULT_THEME_COLOR))) {
      document.documentElement.style.setProperty(property, value);
    }
  }

  if (chromaScale !== undefined) {
    document.documentElement.style.setProperty(
      THEME_CHROMA_SCALE_PROPERTY,
      String(chromaScale ?? DEFAULT_THEME_CHROMA_SCALE),
    );
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
