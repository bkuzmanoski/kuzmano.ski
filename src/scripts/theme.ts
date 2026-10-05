import { THEME_STORAGE_KEY, applyTheme, isThemeSetting } from "#/lib/settings/theme.ts";
import { readStored } from "#/lib/storage.ts";

// Runs in the document head before first paint (prior to hydration) so the chosen palette is
// applied from the first paint.

const storedTheme = readStored(THEME_STORAGE_KEY);

if (storedTheme !== null && isThemeSetting(storedTheme)) {
  applyTheme(storedTheme);
}
