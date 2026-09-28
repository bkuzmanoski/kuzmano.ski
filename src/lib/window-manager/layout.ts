import { clamp } from "../math.ts";

import { isUnmeasured } from "./window.ts";

import type { Rect, Size } from "../geometry.ts";
import type { WindowId, WindowLayout } from "./window.ts";

const fitToSurface = (defaultLength: number, surfaceLength: number, padding: number): number =>
  Math.max(0, Math.min(defaultLength, surfaceLength - 2 * padding));

// Floors each half separately, as `.unplaced` in `/src/features/window-manager/window.module.css` does, so
// both place a window on the same whole pixel, and a window fitted to the surface exactly at the padding.
const centeredOffset = (surfaceLength: number, windowLength: number): number =>
  Math.floor(surfaceLength / 2) - Math.floor(windowLength / 2);

export function defaultRect(layout: WindowLayout, surface: Size, id: WindowId): Rect {
  const { defaultSize } = layout.windows[id];

  if (isUnmeasured(surface)) {
    return { x: 0, y: 0, ...defaultSize };
  }

  const width = fitToSurface(defaultSize.width, surface.width, layout.padding);
  const height = fitToSurface(defaultSize.height, surface.height, layout.padding);

  return { x: centeredOffset(surface.width, width), y: centeredOffset(surface.height, height), width, height };
}

export type WindowPlacer = (geometry: Rect, surface: Size) => Rect;

export function createWindowPlacer(layout: WindowLayout): WindowPlacer {
  return function placeWindow(geometry, surface) {
    if (isUnmeasured(surface)) {
      return geometry;
    }

    const width = Math.min(geometry.width, Math.max(0, surface.width - 2 * layout.padding));
    const height = Math.min(geometry.height, Math.max(0, surface.height - 2 * layout.padding));

    return {
      x: clamp(geometry.x, layout.padding, surface.width - layout.padding - width),
      y: clamp(geometry.y, layout.padding, surface.height - layout.padding - height),
      width,
      height,
    };
  };
}

export type WindowResizer = (geometry: Rect, surface: Size, size: Size) => Rect;

export function createWindowResizer(layout: WindowLayout): WindowResizer {
  const placeWindow = createWindowPlacer(layout);

  return function resizeWindow(geometry, surface, size) {
    const placedGeometry = placeWindow(geometry, surface);

    return placeWindow(
      {
        ...placedGeometry,
        width: Math.max(layout.minSize.width, size.width),
        height: Math.max(layout.minSize.height, size.height),
      },
      surface,
    );
  };
}
