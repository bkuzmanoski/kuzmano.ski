export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const THEME_ATTRIBUTE = "data-theme";

/** Mirrors `--color-background` in `src/styles.css`. */
export const THEME_COLORS = {
  light: "#f4f5f8",
  dark: "#17181e",
};

export const isTheme = (value: string): value is Theme => value === "system" || value === "light" || value === "dark";

/**
 * Only the explicit modes set the attribute. "system" leaves it absent so that the
 * OS media query controls the palette.
 *
 * The `theme-color` metas track only the OS scheme, so an explicit mode overrides
 * both of them; "system" restores each meta's own scheme.
 *
 * This module has no imports, so the pre-hydration theme script can share it (see
 * `build/inline-script.ts`).
 */
export function applyTheme(theme: Theme) {
  if (theme === "system") {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  } else {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }

  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.getAttribute("media")?.includes("dark") ? "dark" : "light";
    meta.content = THEME_COLORS[theme === "system" ? scheme : theme];
  }
}
