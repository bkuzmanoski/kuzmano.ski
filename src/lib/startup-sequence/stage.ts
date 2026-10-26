import { transformBetween } from "../geometry.ts";

import type { Inset, Position, Rect, Size, Transform } from "../geometry.ts";

// Metrics derived from the illustration, in its own coordinates.
const ILLUSTRATION_RECT: Rect = { x: 0, y: 0, width: 1214, height: 1067 };
const DISPLAY_RECT: Rect = { x: 330, y: 99, width: 554, height: 410 };
const DISK_ACTIVITY_INDICATOR_RECT: Rect = { x: 890, y: 670, width: 6, height: 6 };
const FOCUS_AREA_RECT: Rect = { x: 271, y: 52, width: 672, height: 504 };

// Metrics as fractions of the illustration's box.
const DISPLAY_PLACEMENT: Rect = {
  x: DISPLAY_RECT.x / ILLUSTRATION_RECT.width,
  y: DISPLAY_RECT.y / ILLUSTRATION_RECT.height,
  width: DISPLAY_RECT.width / ILLUSTRATION_RECT.width,
  height: DISPLAY_RECT.height / ILLUSTRATION_RECT.height,
};

export const DISPLAY_BEZEL_INSET: Inset = { top: 28, right: 24, bottom: 28, left: 24 };
export const DISK_ACTIVITY_INDICATOR_PLACEMENT: Rect = {
  x: DISK_ACTIVITY_INDICATOR_RECT.x / ILLUSTRATION_RECT.width,
  y: DISK_ACTIVITY_INDICATOR_RECT.y / ILLUSTRATION_RECT.height,
  width: DISK_ACTIVITY_INDICATOR_RECT.width / ILLUSTRATION_RECT.width,
  height: DISK_ACTIVITY_INDICATOR_RECT.height / ILLUSTRATION_RECT.height,
};
export const FOCAL_POINT: Position = {
  x: DISPLAY_PLACEMENT.x + DISPLAY_PLACEMENT.width / 2,
  y: DISPLAY_PLACEMENT.y + DISPLAY_PLACEMENT.height / 2,
};
export const KEYBOARD_PARALLAX: { translate: Position; scale: Position } = {
  translate: { x: 0, y: 0.01 },
  scale: { x: 1.07, y: 1.045 },
};

// How much of each viewport axis a framed area is allowed to fill.
const ZOOMED_OUT_EXTENT: Size = { width: 0.8, height: 0.8 };
const ZOOMED_IN_EXTENT: Size = { width: 1.0, height: 1.0 };

const KEYBOARD_PARALLAX_BOTTOM_OVERFLOW =
  KEYBOARD_PARALLAX.translate.y + (KEYBOARD_PARALLAX.scale.y - 1) * (1 - FOCAL_POINT.y); // How far the parallax moves the keyboard's bottom edge below the illustration's box, as a fraction of its height.

function displayAreaOf(box: Rect): Rect {
  return {
    x: box.x + box.width * DISPLAY_PLACEMENT.x,
    y: box.y + box.height * DISPLAY_PLACEMENT.y,
    width: box.width * DISPLAY_PLACEMENT.width,
    height: box.height * DISPLAY_PLACEMENT.height,
  };
}

// Returns the illustration's viewport-relative box with `area` fitted within the per-axis limits in `scaleExtent`.
// `bottomOverflow` is the fraction of the illustration's height that extends below its box when zoomed in.
//
// If height constrains the scale, `minimumTop` vertically centers `area` and is below `centeredTop`. If width constrains
// it, `centeredTop` centers the illustration and its overflow, while `minimumTop` prevents `area` from rising above the
// viewport's top margin.
function framedOn(area: Rect, scaleExtent: Size, viewport: Size, bottomOverflow = 0): Rect {
  const scale = Math.min(
    (scaleExtent.width * viewport.width) / area.width,
    (scaleExtent.height * viewport.height) / area.height,
  );
  const height = ILLUSTRATION_RECT.height * scale;
  const minimumTop = ((1 - scaleExtent.height) * viewport.height) / 2 - area.y * scale;
  const centeredTop = (viewport.height - height * (1 + bottomOverflow)) / 2;

  return {
    x: viewport.width / 2 - (area.x + area.width / 2) * scale,
    y: Math.max(minimumTop, centeredTop),
    width: ILLUSTRATION_RECT.width * scale,
    height,
  };
}

const zoomedOutBoxFor = (viewport: Size) => framedOn(ILLUSTRATION_RECT, ZOOMED_OUT_EXTENT, viewport);
const zoomedInBoxFor = (viewport: Size) =>
  framedOn(FOCUS_AREA_RECT, ZOOMED_IN_EXTENT, viewport, KEYBOARD_PARALLAX_BOTTOM_OVERFLOW);

export interface StageMetrics {
  viewport: Size;
  illustration: Rect; // The illustration's box, in viewport coordinates.
  display: Rect; // The display cutout in the illustration, in viewport coordinates.
  scale: number; // The illustration's rendered size over its own coordinates, which the screen inside the display scales with.
  zoomOut: Transform; // Takes the stage back out to the framing the illustration is revealed at.
}

/**
 * The stage's geometry for a viewport.
 *
 * The illustration is placed at the framing the stage zooms in to, and the zoom out is the transform that takes the
 * illustration back to the framing it is initially revealed at.
 */
export function stageMetricsFor(viewport: Size): StageMetrics {
  const illustration = zoomedInBoxFor(viewport);
  return {
    viewport,
    illustration,
    display: displayAreaOf(illustration),
    scale: illustration.width / ILLUSTRATION_RECT.width,
    zoomOut: transformBetween(illustration, zoomedOutBoxFor(viewport)),
  };
}
