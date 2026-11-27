import { computedColorOf } from "../computed-color.ts";

const SCREENSAVER_THEME_COLOR_ATTRIBUTE = "data-screensaver-theme-color";
const SCREENSAVER_THEME_COLOR_SELECTOR = `meta[${SCREENSAVER_THEME_COLOR_ATTRIBUTE}]`;
const SCREENSAVER_BACKDROP_PROPERTY = "--color-screensaver-backdrop";

/**
 * Prepends a `theme-color` meta tag for the screensaver backdrop (removed on wake), taking precedence over the pair
 * rendered by `root-document.tsx`. One tag covers both color schemes and reads its color from the stylesheet so browser
 * chrome stays in sync with the backdrop.
 */
export function setScreensaverThemeColor() {
  if (document.querySelector(SCREENSAVER_THEME_COLOR_SELECTOR)) {
    return;
  }

  // `computedColorOf` returns the inherited text color for a `var()` of an undeclared property.
  if (!getComputedStyle(document.documentElement).getPropertyValue(SCREENSAVER_BACKDROP_PROPERTY)) {
    return;
  }

  const backdropColor = computedColorOf(`var(${SCREENSAVER_BACKDROP_PROPERTY})`);

  const themeColorMeta = document.createElement("meta");

  themeColorMeta.setAttribute(SCREENSAVER_THEME_COLOR_ATTRIBUTE, "");
  themeColorMeta.name = "theme-color";
  themeColorMeta.content = backdropColor;

  document.head.prepend(themeColorMeta);
}

export function clearScreensaverThemeColor() {
  document.querySelectorAll(SCREENSAVER_THEME_COLOR_SELECTOR).forEach((meta) => meta.remove());
}
