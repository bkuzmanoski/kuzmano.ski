import { clamp } from "./math";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Position, Size {}

export function constrain(rect: Rect, container: Size): Rect {
  if (container.width === 0 || container.height === 0) {
    return rect;
  }

  const width = Math.min(rect.width, container.width);
  const height = Math.min(rect.height, container.height);

  return {
    x: clamp(rect.x, 0, container.width - width),
    y: clamp(rect.y, 0, container.height - height),
    width,
    height,
  };
}
