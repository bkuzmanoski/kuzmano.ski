import { THEME_STORAGE_KEY, applyTheme, isTheme } from "#/lib/theme";

/* Runs in the document head before first paint (prior to hydration) so the
 * chosen palette is applied without a flash of the default theme. */
try {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);

  if (stored !== null && isTheme(stored)) {
    applyTheme(stored);
  }
} catch {
  // Ignored.
}
