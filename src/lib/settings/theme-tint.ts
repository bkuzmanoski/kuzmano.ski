// Imports only leaf modules because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`) and
// `/vite.config.ts` loads it through `/build`.
import { accentColorOf } from "../accent-colors.ts";

import type { AccentColorName } from "../accent-colors.ts";
import type { SteppedRange } from "../stepped-range.ts";

export const THEME_CHROMA_SCALE_PROPERTY = "--theme-chroma-scale";

export const DEFAULT_THEME_COLOR: AccentColorName = "purple";
export const DEFAULT_THEME_CHROMA_SCALE = 1;

/**
 * Neutral colors remain within the sRGB gamut at every hue up to a scale of 2.6. Using a power-of-two step keeps
 * `isSteppedValueIn` step counts exact.
 */
export const THEME_CHROMA_SCALE_RANGE: SteppedRange = { min: 0, max: 2.5, step: 0.25 };

export const themeColorPropertiesOf = (themeColor: AccentColorName) => ({
  "--theme-hue": `var(--accent-${themeColor}-hue)`,
  "--color-accent": accentColorOf(themeColor),
});

/** The custom properties `RootDocument` sets and the build resolves the palette with. */
export const DEFAULT_THEME_TINT_PROPERTIES = {
  ...themeColorPropertiesOf(DEFAULT_THEME_COLOR),
  [THEME_CHROMA_SCALE_PROPERTY]: String(DEFAULT_THEME_CHROMA_SCALE),
};
