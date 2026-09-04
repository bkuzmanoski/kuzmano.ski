import { clamp } from "../math.ts";

import { isUnmeasured } from "./window.ts";

import type { Rect, Size } from "../geometry.ts";
import type { WindowId, WindowLayout } from "./window.ts";

const fitToSurface = (defaultLength: number, surfaceLength: number, padding: number): number =>
  Math.max(0, Math.min(defaultLength, surfaceLength - 2 * padding));

export function defaultRect(layout: WindowLayout, surface: Size, id: WindowId): Rect {
  const { defaultSize } = layout.windows[id];

  if (isUnmeasured(surface)) {
    return { x: 0, y: 0, ...defaultSize };
  }

  const width = fitToSurface(defaultSize.width, surface.width, layout.padding);
  const height = fitToSurface(defaultSize.height, surface.height, layout.padding);

  // The position is left unrounded so that it matches, to the pixel, where CSS centers a
  // pre-rendered window (see `.unplaced` in `/src/features/windows/window.module.css`).
  return { x: (surface.width - width) / 2, y: (surface.height - height) / 2, width, height };
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
    const placed = placeWindow(geometry, surface);

    return placeWindow(
      {
        ...placed,
        width: Math.max(layout.minSize.width, size.width),
        height: Math.max(layout.minSize.height, size.height),
      },
      surface,
    );
  };
}
