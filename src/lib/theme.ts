export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const THEME_ATTRIBUTE = "data-theme";

export const isTheme = (value: string): value is Theme => value === "system" || value === "light" || value === "dark";

/**
 * Only the explicit modes set the attribute. "system" leaves it absent so that the
 * OS media query controls the palette.
 *
 * This module has no imports, so the pre-hydration theme script can use it (see
 * `build/inline-script.ts`).
 */
export function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  } else {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }
}
