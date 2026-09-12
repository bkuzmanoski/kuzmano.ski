import { THEME_STORAGE_KEY, applyTheme, isThemeSetting } from "#/lib/settings/theme.ts";
import { readStored } from "#/lib/storage.ts";

// Runs in the document head before first paint (prior to hydration) so
// the chosen palette is applied without a flash of the default theme.
const storedTheme = readStored(THEME_STORAGE_KEY);

if (storedTheme !== null && isThemeSetting(storedTheme)) {
  applyTheme(storedTheme);
}
