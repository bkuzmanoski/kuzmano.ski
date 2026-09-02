const ICON_SELECTOR = 'link[rel="icon"][type="image/svg+xml"]';
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const SCHEME_PARAMETER = "color-scheme";

/**
 * Updates the SVG favicon to match the current system color scheme.
 *
 * `favicon.svg` already has a `prefers-color-scheme` query, but Chromium evaluates it only
 * once at load time and may cache the result from an earlier visit. The favicon is therefore
 * updated on start and whenever the scheme changes.
 *
 * Changes are deferred while the tab is hidden because the browser does not re-fetch its
 * favicon. `applied` avoids a redundant re-fetch when the scheme changes back while hidden.
 *
 * TODO: Remove this once https://crbug.com/1026539 is fixed.
 */
export function watchFaviconColorScheme(): () => void {
  const media = (window as Partial<Window>).matchMedia?.(DARK_SCHEME_QUERY);
  const icon = document.querySelector<HTMLLinkElement>(ICON_SELECTOR);
  const source = icon?.getAttribute("href")?.split("?")[0];

  if (!media || !icon || !source) {
    return () => undefined;
  }

  let applied: string | undefined;

  const sync = () => {
    if (document.visibilityState !== "visible") {
      return;
    }

    const scheme = media.matches ? "dark" : "light";

    if (scheme === applied) {
      return;
    }

    applied = scheme;
    icon.href = `${source}?${SCHEME_PARAMETER}=${scheme}`;
  };

  media.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  sync();

  return () => {
    media.removeEventListener("change", sync);
    document.removeEventListener("visibilitychange", sync);
  };
}
