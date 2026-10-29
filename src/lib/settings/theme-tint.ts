// Imports only types because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`) and
// `/vite.config.ts` loads it through `/build`.
import type { SteppedRange } from "../stepped-range.ts";

export const THEME_CHROMA_SCALE_PROPERTY = "--theme-chroma-scale";

/** The default theme values declared in `:root` (`/src/styles.css`). */
export interface ThemeDefaults {
  chromaScale: number;
}

export const THEME_CHROMA_SCALE_RANGE: SteppedRange = { min: 0, max: 2.5, step: 0.25 }; // Neutral colors remain within the sRGB gamut at every hue up to a scale of 2.6. Using a power-of-two step keeps `isSteppedValueIn` step counts exact.
