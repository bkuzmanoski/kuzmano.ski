// Has no imports because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`) and
// `/vite.config.ts` loads it through `/build`.

/** A range of numbers a control moves through in equal steps, such as a `Slider`'s. */
export interface SteppedRange {
  min: number;
  max: number;
  step: number;
}

export const stepCountOf = ({ min, max, step }: SteppedRange): number => Math.round((max - min) / step);

/** Whether `value` is within `range` and a whole number of steps from its minimum. */
export const isSteppedValueIn = (value: number, { min, max, step }: SteppedRange): boolean =>
  value >= min && value <= max && Number.isInteger((value - min) / step);
