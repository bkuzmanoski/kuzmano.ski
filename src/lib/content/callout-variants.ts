/**
 * Valid values for a `Callout`'s `variant` prop. The build uses this list to validate
 * authored props (see `/build/content/markup/callout-variants.ts`).
 */
export const CALLOUT_VARIANTS = ["note", "warning"] as const;

export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];
