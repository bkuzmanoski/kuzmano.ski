// Imports only types because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`) and
// `/vite.config.ts` loads it through `/build`.
import type { StyleWithVars } from "./style.ts";

/** `--accent-*` colors declared in `/src/styles.css`, in the order listed by the theme color options. */
export const ACCENT_COLOR_NAMES = ["purple", "orange", "green", "turquoise", "red", "pink", "blue"] as const;

/** One of the `--accent-*` colors declared in `/src/styles.css`. */
export type AccentColorName = (typeof ACCENT_COLOR_NAMES)[number];

export const accentColorOf = (accent: AccentColorName): string => `var(--accent-${accent})`;

export const accentColorVariable = (propertyName: `--${string}`, accent: AccentColorName): StyleWithVars => ({
  [propertyName]: accentColorOf(accent),
});
