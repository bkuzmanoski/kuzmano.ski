import {
  COLOR_SCHEMES,
  applyDesktopBackgroundThemeColor,
  applyThemeTint,
  desktopBackgroundThemeColorStorageKeyFor,
  readStoredThemeTint,
} from "#/lib/settings/theme.ts";
import { readStored } from "#/lib/storage.ts";

// Runs in the document head before first paint (prior to hydration) so the stored theme tint
// (the theme color and chroma scale) is applied from the first paint.

const storedThemeTint = readStoredThemeTint();

// The build renders desktop background `theme-color` values for the stylesheet's default tint. When a tint is stored,
// replace them with the values `watchDesktopBackgroundThemeColors` computed for the last applied tint.
if (storedThemeTint !== null) {
  applyThemeTint(storedThemeTint);

  for (const colorScheme of COLOR_SCHEMES) {
    applyDesktopBackgroundThemeColor(colorScheme, readStored(desktopBackgroundThemeColorStorageKeyFor(colorScheme)));
  }
}
