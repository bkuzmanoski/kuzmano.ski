// This module has no imports, so build plugins and the pre-hydration theme script can use it.

export const THEME_CHROMA_SCALE_PROPERTY = "--theme-chroma-scale";

/** The default theme values declared in `:root` (`/src/styles.css`). */
export interface ThemeDefaults {
  chromaScale: number;
}

export interface SteppedRange {
  min: number;
  max: number;
  step: number;
}

export const THEME_CHROMA_SCALE_RANGE: SteppedRange = { min: 0, max: 2.5, step: 0.25 }; // Neutral colors remain within the sRGB gamut at every hue up to a scale of 2.6. Using a power-of-two step keeps `isSteppedValueIn` step counts exact.

export const stepCountOf = ({ min, max, step }: SteppedRange): number => Math.round((max - min) / step);

/** Whether `value` is within `range` and a whole number of steps from its minimum. */
export const isSteppedValueIn = (value: number, { min, max, step }: SteppedRange): boolean =>
  value >= min && value <= max && Number.isInteger((value - min) / step);
