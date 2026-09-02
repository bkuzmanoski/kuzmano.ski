import { clamp } from "../math";

import { isUnmeasured } from "./window";

import type { Rect, Size } from "../geometry";
import type { WindowId, WindowLayout } from "./window";

function cascadeAxis(
  padding: number,
  surfaceLength: number,
  defaultLength: number,
  minLength: number,
  offset: number,
): { position: number; extent: number } {
  const center = Math.max(padding, (surfaceLength - defaultLength) / 2);
  const extentAt = (position: number) => Math.min(defaultLength, surfaceLength - padding - position);
  const stepped = center + offset;

  // The result is left unrounded so that it matches, to the pixel, where CSS centers a
  // pre-rendered window (see `.unplaced` in `/src/components/window.module.css`).
  const position = extentAt(stepped) < minLength ? center : stepped;

  return { position, extent: extentAt(position) };
}

export function cascadeSlot(layout: WindowLayout, surface: Size, id: WindowId, step: number): Rect {
  const { defaultSize } = layout.windows[id];
  const offsetX = step * layout.cascadeOffset.x;
  const offsetY = step * layout.cascadeOffset.y;

  if (isUnmeasured(surface)) {
    return { x: offsetX, y: offsetY, ...defaultSize };
  }

  const { padding, minSize } = layout;
  const horizontal = cascadeAxis(padding, surface.width, defaultSize.width, minSize.width, offsetX);
  const vertical = cascadeAxis(padding, surface.height, defaultSize.height, minSize.height, offsetY);

  return {
    x: horizontal.position,
    y: vertical.position,
    width: horizontal.extent,
    height: vertical.extent,
  };
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
