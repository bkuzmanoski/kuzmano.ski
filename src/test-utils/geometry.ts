import type { Rect, Transform } from "#/lib/geometry.ts";

/** Applies `transform` to `box` the way the compositor does, for an origin at the viewport's top-left corner. */
export const transformedBox = ({ scale, x, y }: Transform, box: Rect): Rect => ({
  x: box.x * scale + x,
  y: box.y * scale + y,
  width: box.width * scale,
  height: box.height * scale,
});
