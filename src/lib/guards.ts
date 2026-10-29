// Has no imports because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`) and
// `/vite.config.ts` loads it through `/build`.

/** Returns a guard that narrows a string to one of `values`. */
export const isOneOf =
  <TValue extends string>(values: ReadonlyArray<TValue>) =>
  (value: string | null): value is TValue =>
    (values as ReadonlyArray<string | null>).includes(value);

/** Narrows unknown input to a non-null object with named properties. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
