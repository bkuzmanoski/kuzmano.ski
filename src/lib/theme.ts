// This module has no imports, so the pre-hydration theme script can use it (see `/build/inline-scripts.ts`).

export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const THEME_ATTRIBUTE = "data-theme";

export const isTheme = (value: string): value is Theme => value === "system" || value === "light" || value === "dark";

export function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  } else {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }
}
