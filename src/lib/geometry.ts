import { clamp } from "./math.ts";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Position, Size {}

export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Transform {
  scale: number;
  x: number;
  y: number;
}

export const distanceBetween = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);

export const clientPositionOf = (event: { clientX: number; clientY: number }): Position => ({
  x: event.clientX,
  y: event.clientY,
});

/** Returns the layout viewport dimensions. */
export const viewportSize = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

/** Whether a point falls within a rect, counting its edges as within. */
export function containsPoint(rect: Rect, { x, y }: Position): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

/** Translates `rect` into coordinates relative to `origin`. */
export const rectRelativeTo = ({ x, y, width, height }: Rect, origin: Position): Rect => ({
  x: x - origin.x,
  y: y - origin.y,
  width,
  height,
});

/** Returns the overlapping region of two rects, or `null` if they do not overlap. */
export function intersectionOf(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;

  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

/**
 * Returns the fraction of `rect`'s area inside `bounds` (`0` to `1`, matching `IntersectionObserver`), or `0` if `rect`
 * is empty.
 */
export function intersectionRatioOf(rect: Rect, bounds: Rect): number {
  const intersection = intersectionOf(rect, bounds);
  const area = rect.width * rect.height;

  return intersection && area > 0 ? (intersection.width * intersection.height) / area : 0;
}

/** Clamps a cell's leading edge so a cell of `cellSize` stays inside a container of `containerSize`. */
export function clampToContainer(position: number, containerSize: number, cellSize: number): number {
  return clamp(position, 0, containerSize - cellSize);
}

export function scaleInset(inset: Inset, scale: number): Inset {
  return {
    top: inset.top * scale,
    right: inset.right * scale,
    bottom: inset.bottom * scale,
    left: inset.left * scale,
  };
}

export function insetRect(rect: Rect, inset: Inset): Rect {
  return {
    x: rect.x + inset.left,
    y: rect.y + inset.top,
    width: rect.width - inset.left - inset.right,
    height: rect.height - inset.top - inset.bottom,
  };
}

/** Insets for a child of `box` that places its edges on the edges of the viewport. */
export function insetToViewport(box: Rect, viewport: Size): Inset {
  return {
    top: -box.y,
    right: box.x + box.width - viewport.width,
    bottom: box.y + box.height - viewport.height,
    left: -box.x,
  };
}

/** Insets for a child of the viewport that places its edges on the edges of `box`. */
export function insetFromViewport(box: Rect, viewport: Size): Inset {
  return {
    top: box.y,
    right: viewport.width - box.x - box.width,
    bottom: viewport.height - box.y - box.height,
    left: box.x,
  };
}

/**
 * Returns the uniform scale and translation that maps `from` onto `to` (assuming shared aspect ratio and a transform
 * origin at the coordinate origin).
 */
export function transformBetween(from: Rect, to: Rect): Transform {
  const scale = from.width === 0 ? 1 : to.width / from.width;
  return {
    scale,
    x: to.x - from.x * scale,
    y: to.y - from.y * scale,
  };
}
