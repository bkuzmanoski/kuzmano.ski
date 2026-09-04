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

/** Whether a point falls within a rect, counting its edges as within. */
export function containsPoint(rect: Rect, { x, y }: Position): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
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

/**
 * Insets for a child of `box` that places its edges on the edges of the viewport.
 * Each edge is given its own distance to travel, so animating to them reaches all
 * four corners at the same time.
 */
export function insetToViewport(box: Rect, viewport: Size): Inset {
  return {
    top: -box.y,
    right: box.x + box.width - viewport.width,
    bottom: box.y + box.height - viewport.height,
    left: -box.x,
  };
}

/**
 * The scale and translation that places `from` where `to` is, for an element whose transform
 * origin is the origin of the coordinates both rects are given in. The rects are taken to
 * share an aspect ratio, so their widths set the scale on both axes.
 */
export function transformBetween(from: Rect, to: Rect): Transform {
  const scale = from.width === 0 ? 1 : to.width / from.width;
  return {
    scale,
    x: to.x - from.x * scale,
    y: to.y - from.y * scale,
  };
}
