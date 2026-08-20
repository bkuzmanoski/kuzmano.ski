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

  const backdrop = getComputedStyle(document.documentElement).getPropertyValue(SCREENSAVER_BACKDROP_PROPERTY).trim();

  if (!backdrop) {
    return;
  }

  const meta = document.createElement("meta");

  meta.setAttribute(SCREENSAVER_THEME_COLOR_ATTRIBUTE, "");
  meta.name = "theme-color";
  meta.content = backdrop;

  document.head.prepend(meta);
}

export function clearScreensaverThemeColor() {
  document.querySelectorAll(SCREENSAVER_THEME_COLOR_SELECTOR).forEach((meta) => meta.remove());
}
