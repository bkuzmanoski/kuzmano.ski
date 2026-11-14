import { describe, expect, test } from "vitest";

import { depthOf } from "../convex-polygon.ts";

import { createOverlapRegions, extendedHalfPlanesOf, isNearRegion } from "./overlap-region.ts";

import type { ConvexPolygon, HalfPlane } from "../convex-polygon.ts";
import type { Position } from "../geometry.ts";

const CLEARANCE_PX = 8;
const BOX_BOUNDS = { left: 8, top: 16, right: 56, bottom: 48 };
const BOX_OUTLINE: ConvexPolygon = [
  { x: BOX_BOUNDS.left, y: BOX_BOUNDS.top },
  { x: BOX_BOUNDS.right, y: BOX_BOUNDS.top },
  { x: BOX_BOUNDS.right, y: BOX_BOUNDS.bottom },
  { x: BOX_BOUNDS.left, y: BOX_BOUNDS.bottom },
];

/** The horizontal distance between two sprites with `BOX_OUTLINE` side by side, `CLEARANCE_PX` apart. */
const CONTACT_SPACING_PX = BOX_BOUNDS.right - BOX_BOUNDS.left + CLEARANCE_PX;

const isInside = (halfPlanes: ReadonlyArray<HalfPlane>, offset: Position) => depthOf(halfPlanes, offset) > 0;

describe("createOverlapRegions", () => {
  test("returns a region that contains the offsets at which two outlines come within `clearancePx`, and omits those farther apart", () => {
    const { halfPlanes } = createOverlapRegions({ descentPerPx: 0, clearancePx: CLEARANCE_PX })(
      BOX_OUTLINE,
      BOX_OUTLINE,
    );

    expect(isInside(halfPlanes, { x: CONTACT_SPACING_PX - 0.01, y: 0 })).toBe(true);
    expect(isInside(halfPlanes, { x: CONTACT_SPACING_PX + 0.01, y: 0 })).toBe(false);
  });

  test("returns a region in lane coordinates, on lanes that descend `descentPerPx` for each pixel to the left", () => {
    const descentPerPx = 0.5;
    const { halfPlanes } = createOverlapRegions({ descentPerPx, clearancePx: CLEARANCE_PX })(BOX_OUTLINE, BOX_OUTLINE);

    // The other outline starts 2px right of the first, and its top lies 2px above the first's bottom.
    const screenOffset = { x: BOX_BOUNDS.right - BOX_BOUNDS.left + 2, y: BOX_BOUNDS.bottom - BOX_BOUNDS.top - 2 };

    expect(isInside(halfPlanes, { x: screenOffset.x, y: screenOffset.y + descentPerPx * screenOffset.x })).toBe(true);
  });

  test("returns the same region each time for a pair of outlines", () => {
    const overlapRegionOf = createOverlapRegions({ descentPerPx: 0.5, clearancePx: CLEARANCE_PX });

    expect(overlapRegionOf(BOX_OUTLINE, BOX_OUTLINE)).toBe(overlapRegionOf(BOX_OUTLINE, BOX_OUTLINE));
  });
});

describe("isNearRegion", () => {
  const region = createOverlapRegions({ descentPerPx: 0, clearancePx: CLEARANCE_PX })(BOX_OUTLINE, BOX_OUTLINE);
  const pathStart = { x: region.left - 10, y: (region.top + region.bottom) / 2 };

  test("returns `true` for a path that crosses the region's bounds with both ends outside them", () => {
    expect(isNearRegion(region, 0, pathStart, { x: region.right + 10, y: pathStart.y })).toBe(true);
  });

  test("returns `false` for a path that ends left of the region's bounds", () => {
    expect(isNearRegion(region, 0, pathStart, { x: region.left - 1, y: pathStart.y })).toBe(false);
  });

  test("returns `true` for a path within `reachPx` right of the region's bounds, and `false` without the reach", () => {
    const pathRightOfRegion = { x: region.right + 5, y: pathStart.y };

    expect(isNearRegion(region, 10, pathRightOfRegion, pathRightOfRegion)).toBe(true);
    expect(isNearRegion(region, 0, pathRightOfRegion, pathRightOfRegion)).toBe(false);
  });
});

describe("extendedHalfPlanesOf", () => {
  test("extends the region right by `reachPx`", () => {
    const region = createOverlapRegions({ descentPerPx: 0, clearancePx: CLEARANCE_PX })(BOX_OUTLINE, BOX_OUTLINE);
    const offsetY = (region.top + region.bottom) / 2;

    expect(isInside(extendedHalfPlanesOf(region, 10), { x: region.right + 9.99, y: offsetY })).toBe(true);
    expect(isInside(extendedHalfPlanesOf(region, 10), { x: region.right + 10.01, y: offsetY })).toBe(false);
  });

  test("omits each offset above the region's top or below its bottom", () => {
    const region = createOverlapRegions({ descentPerPx: 0.5, clearancePx: CLEARANCE_PX })(BOX_OUTLINE, BOX_OUTLINE);
    const reachPx = 10;
    const halfPlanes = extendedHalfPlanesOf(region, reachPx);
    const offsetXs = Array.from({ length: region.right + reachPx - region.left }, (_, index) => region.left + index);

    expect(offsetXs.filter((x) => isInside(halfPlanes, { x, y: region.top - 0.01 }))).toEqual([]);
    expect(offsetXs.filter((x) => isInside(halfPlanes, { x, y: region.bottom + 0.01 }))).toEqual([]);
  });
});
