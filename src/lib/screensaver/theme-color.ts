const SCREENSAVER_THEME_COLOR_ATTRIBUTE = "data-screensaver-theme-color";
const SCREENSAVER_THEME_COLOR_SELECTOR = `meta[${SCREENSAVER_THEME_COLOR_ATTRIBUTE}]`;
const SCREENSAVER_BACKDROP_PROPERTY = "--color-screensaver-backdrop";

/**
 * The browser reads the first `theme-color` in tree order whose media matches, so the
 * screensaver's goes ahead of the pair `root-document.tsx` renders and comes back off on waking.
 * One tag covers both schemes because the backdrop is the same color in either. Its value is read
 * from the stylesheet so that the chrome cannot drift from what the screensaver paints.
 */
export function setScreensaverThemeColor() {
  if (document.querySelector(SCREENSAVER_THEME_COLOR_SELECTOR)) {
    return;
  }

  const backdropColor = getComputedStyle(document.documentElement)
    .getPropertyValue(SCREENSAVER_BACKDROP_PROPERTY)
    .trim();

  if (!backdropColor) {
    return;
  }

  const themeColorMeta = document.createElement("meta");

  themeColorMeta.setAttribute(SCREENSAVER_THEME_COLOR_ATTRIBUTE, "");
  themeColorMeta.name = "theme-color";
  themeColorMeta.content = backdropColor;

  document.head.prepend(themeColorMeta);
}

export function clearScreensaverThemeColor() {
  document.querySelectorAll(SCREENSAVER_THEME_COLOR_SELECTOR).forEach((meta) => meta.remove());
}
