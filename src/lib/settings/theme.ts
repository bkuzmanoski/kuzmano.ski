// This module imports only a leaf module, so the pre-hydration theme script can use it (see `/build/inline-scripts.ts`).
import { createEmitter } from "../emitter.ts";

export type ThemeSetting = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const THEME_ATTRIBUTE = "data-theme";

export const isThemeSetting = (value: string): value is ThemeSetting =>
  value === "system" || value === "light" || value === "dark";

const themeAppliedEmitter = createEmitter();

export function applyTheme(theme: ThemeSetting) {
  if (theme === "system") {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  } else {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }

  themeAppliedEmitter.emit();
}

/**
 * Calls `onChange` whenever the color scheme the document is shown in may have changed.
 *
 * Returns a function that stops listening.
 */
export function subscribeToColorSchemeChange(onChange: () => void): () => void {
  const systemColorSchemeQuery = (window as Partial<Window>).matchMedia?.("(prefers-color-scheme: dark)");
  const unsubscribeFromThemeApplication = themeAppliedEmitter.subscribe(onChange);

  systemColorSchemeQuery?.addEventListener("change", onChange);

  return () => {
    systemColorSchemeQuery?.removeEventListener("change", onChange);
    unsubscribeFromThemeApplication();
  };
}
