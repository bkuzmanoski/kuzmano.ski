export const DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** Returns the media query list for `query`, or `null` where the window has no `matchMedia`. */
export const mediaQueryListFor = (query: string): MediaQueryList | null =>
  (window as Partial<Window>).matchMedia?.(query) ?? null;
