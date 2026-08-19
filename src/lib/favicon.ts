const ICON_SELECTOR = 'link[rel="icon"][type="image/svg+xml"]';
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
const SCHEME_PARAMETER = "color-scheme";

/**
 * Repoints the SVG favicon when the system color scheme changes.
 *
 * `favicon.svg` already carries its own `prefers-color-scheme` media query, but
 * Chromium evaluates only once at load time.
 *
 * TODO: Remove this once https://crbug.com/1026539 is fixed.
 */
export function watchFaviconColorScheme(): () => void {
  const media = (window as Partial<Window>).matchMedia?.(DARK_SCHEME_QUERY);
  const icon = document.querySelector<HTMLLinkElement>(ICON_SELECTOR);
  const source = icon?.getAttribute("href")?.split("?")[0];

  if (!media || !icon || source === undefined) {
    return () => undefined;
  }

  const onChange = ({ matches }: MediaQueryListEvent) => {
    icon.href = `${source}?${SCHEME_PARAMETER}=${matches ? "dark" : "light"}`;
  };

  media.addEventListener("change", onChange);

  return () => media.removeEventListener("change", onChange);
}
