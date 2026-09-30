/**
 * The whole pixels to add to the space before an element so that the lowest of the rail items before it
 * ends above `rowTop`, the element's top less the space before it. Returns 0 when every rail item ends
 * above it, or when `railItemBottoms` is empty.
 */
export const railClearanceOf = (railItemBottoms: Array<number>, rowTop: number) =>
  Math.max(0, Math.ceil(Math.max(...railItemBottoms) - rowTop));
