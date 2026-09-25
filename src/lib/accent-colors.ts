import type { StyleWithVars } from "./style.ts";

/** The `--accent-*` colors declared in `/src/styles.css`. */
export const ACCENT_COLOR_NAMES = ["blue", "teal", "green", "orange", "red", "magenta", "violet"] as const;

/** One of the `--accent-*` colors declared in `/src/styles.css`. */
export type AccentColorName = (typeof ACCENT_COLOR_NAMES)[number];

export const accentColorVariable = (propertyName: `--${string}`, accent: AccentColorName): StyleWithVars => ({
  [propertyName]: `var(--accent-${accent})`,
});
