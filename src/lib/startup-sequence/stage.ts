import { transformBetween } from "../geometry.ts";

import type { Inset, Position, Rect, Size, Transform } from "../geometry.ts";

// Illustration metrics in intrinsic coordinates.
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

// Maximum fraction of each viewport axis a framed area may fill.
const ZOOMED_OUT_EXTENT: Size = { width: 0.8, height: 0.8 };
const ZOOMED_IN_EXTENT: Size = { width: 1.0, height: 1.0 };

// Fraction of the illustration's height by which parallax shifts the keyboard below the illustration's box.
const KEYBOARD_PARALLAX_BOTTOM_OVERFLOW =
  KEYBOARD_PARALLAX.translate.y + (KEYBOARD_PARALLAX.scale.y - 1) * (1 - FOCAL_POINT.y);

function displayAreaOf(box: Rect): Rect {
  return {
    x: box.x + box.width * DISPLAY_PLACEMENT.x,
    y: box.y + box.height * DISPLAY_PLACEMENT.y,
    width: box.width * DISPLAY_PLACEMENT.width,
    height: box.height * DISPLAY_PLACEMENT.height,
  };
}

// Returns the illustration's viewport-relative box with `area` fitted within `scaleExtent` (`bottomOverflow` is the
// height fraction extending below the box when zoomed in). Height-constrained layouts center `area` via `minimumTop`;
// width-constrained layouts center the full box plus overflow while `minimumTop` keeps `area` within the top margin.
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
  /** Illustration bounds in viewport coordinates. */
  illustration: Rect;
  /** Display cutout bounds in viewport coordinates. */
  display: Rect;
  /**
   * Ratio of the illustration's rendered size to its intrinsic coordinate space, used to scale the screen inside it.
   */
  scale: number;
  /** Takes the stage back out to the framing of the Macintosh reveal. */
  zoomOut: Transform;
}

/**
 * Computes the stage's geometry for `viewport`.
 *
 * Places the illustration at its zoomed-in framing and returns `zoomOut` to transform it back to the initial reveal
 * framing.
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
