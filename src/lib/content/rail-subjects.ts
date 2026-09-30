/**
 * The content components a rail aside can follow. Each renders its `style` prop on its root element,
 * where the build sets the anchor name the aside is placed beside. The build fails for a rail aside
 * after any other component (see `/build/content/markup/rail-asides.ts`).
 */
export const RAIL_SUBJECT_COMPONENT_NAMES = ["Callout", "ImageGrid", "Waitlist"] as const;
