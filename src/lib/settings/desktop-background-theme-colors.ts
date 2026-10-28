import { computedColorOf } from "../computed-color.ts";
import { writeStored } from "../storage.ts";

import { subscribeToColorChange } from "./color-change.ts";
import { getSettings } from "./settings.ts";
import {
  COLOR_SCHEMES,
  applyDesktopBackgroundThemeColor,
  desktopBackgroundThemeColorStorageKeyFor,
  readStoredThemeTint,
} from "./theme.ts";

import type { Settings } from "./settings.ts";

const themeTintKeyOf = ({ themeColor, themeChromaScale }: Settings) => `${themeColor} ${themeChromaScale}`;

/**
 * Sets the desktop background `theme-color` pair `/src/app/root-document.tsx` renders to the computed
 * `--color-desktop-background` in each color scheme, and stores the colors for the pre-hydration script. Returns a
 * function that stops updates.
 */
export function watchDesktopBackgroundThemeColors(): () => void {
  let pendingAnimationFrame: number | null = null;
  let appliedThemeTintKey =
    readStoredThemeTint() === null
      ? themeTintKeyOf(getSettings()) // The build emits the colors for the stylesheet's default theme tint.
      : null; // Makes the first update compute the colors, since the stored ones may come from an older stylesheet.

  const update = () => {
    pendingAnimationFrame = null;

    const themeTintKey = themeTintKeyOf(getSettings());

    if (themeTintKey === appliedThemeTintKey) {
      return; // Each color is computed in its own color scheme, so a change of appearance or of the system color scheme leaves it unchanged.
    }

    appliedThemeTintKey = themeTintKey;

    for (const colorScheme of COLOR_SCHEMES) {
      const desktopBackgroundColor = computedColorOf("var(--color-desktop-background)", colorScheme);

      applyDesktopBackgroundThemeColor(colorScheme, desktopBackgroundColor);
      writeStored(desktopBackgroundThemeColorStorageKeyFor(colorScheme), desktopBackgroundColor);
    }
  };

  const scheduleUpdate = () => {
    pendingAnimationFrame ??= requestAnimationFrame(update);
  };

  // Waits for an animation frame because this function runs in a hydration effect where reading the colors would
  // restyle the document twice.
  scheduleUpdate();

  const unsubscribeFromColorChange = subscribeToColorChange(scheduleUpdate);

  return () => {
    unsubscribeFromColorChange();

    if (pendingAnimationFrame !== null) {
      cancelAnimationFrame(pendingAnimationFrame);
    }
  };
}
