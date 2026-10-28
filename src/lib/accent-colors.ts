// This module imports only a type so the pre-hydration theme tint script can use it (see `/build/inline-scripts.ts`).
import type { StyleWithVars } from "./style.ts";

/** The `--accent-*` colors declared in `/src/styles.css` in the order the theme color options list them. */
export const ACCENT_COLOR_NAMES = ["purple", "orange", "green", "turquoise", "red", "pink", "blue"] as const;

/** One of the `--accent-*` colors declared in `/src/styles.css`. */
export type AccentColorName = (typeof ACCENT_COLOR_NAMES)[number];

export const accentColorVariable = (propertyName: `--${string}`, accent: AccentColorName): StyleWithVars => ({
  [propertyName]: `var(--accent-${accent})`,
});
