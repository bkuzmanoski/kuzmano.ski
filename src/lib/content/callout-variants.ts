/**
 * The values of a `Callout`'s `variant` prop. MDX does not type-check authored props, so
 * the build reads this list to reject an entry that names any other value (see
 * `/build/content/markup/callout-variants.ts`).
 */
export const CALLOUT_VARIANTS = ["note", "warning"] as const;

export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];
