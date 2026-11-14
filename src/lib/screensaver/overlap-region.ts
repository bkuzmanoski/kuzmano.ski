import { convexHullOf, halfPlanesOf, minkowskiSumOf } from "../convex-polygon.ts";

import type { ConvexPolygon, HalfPlane } from "../convex-polygon.ts";
import type { Position } from "../geometry.ts";

/**
 * The offsets in lane coordinates of one sprite from another at which their padded outlines intersect, with their
 * bounds. The two sprites are too close at an offset inside the polygon in which `halfPlanes` intersect.
 */
export interface OverlapRegion {
  halfPlanes: ReadonlyArray<HalfPlane>;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface OverlapRegionSettings {
  /** How far a sprite descends for each pixel it flies left, which sets the slope of the lanes. */
  descentPerPx: number;
  /** The minimum gap between two sprites' outlines. */
  clearancePx: number;
}

/**
 * The vertices of a regular octagon with an inradius of `1`, which `createOverlapRegions` scales to pad each outline.
 * As the octagon contains the circle of that radius, a padded outline extends at least the scaled radius in every
 * direction.
 */
const UNIT_OCTAGON: ConvexPolygon = Array.from({ length: 8 }, (_, index) => {
  const angle = ((index + 0.5) * Math.PI) / 4;
  const circumradius = 1 / Math.cos(Math.PI / 8);

  return { x: circumradius * Math.cos(angle), y: circumradius * Math.sin(angle) };
});

/**
 * Returns a function that returns the overlap region of a sprite with `otherOutline` from a sprite with `outline`,
 * computing it once for each pair of outlines.
 */
export function createOverlapRegions({ descentPerPx, clearancePx }: OverlapRegionSettings) {
  // Padding each outline by half of `clearancePx` makes two padded outlines intersect wherever the outlines come within
  // `clearancePx` of each other.
  const padding = UNIT_OCTAGON.map(({ x, y }) => ({ x: (x * clearancePx) / 2, y: (y * clearancePx) / 2 }));
  const collisionShapes = new Map<ConvexPolygon, ConvexPolygon>();
  const overlapRegions = new Map<ConvexPolygon, Map<ConvexPolygon, OverlapRegion>>();

  /** Returns `outline`, padded by half of `clearancePx`, in lane coordinates. */
  function collisionShapeOf(outline: ConvexPolygon) {
    let collisionShape = collisionShapes.get(outline);

    if (!collisionShape) {
      collisionShape = convexHullOf(
        minkowskiSumOf(outline, padding).map(({ x, y }) => ({ x, y: y + descentPerPx * x })),
      );
      collisionShapes.set(outline, collisionShape);
    }

    return collisionShape;
  }

  return (outline: ConvexPolygon, otherOutline: ConvexPolygon): OverlapRegion => {
    let regionsForOutline = overlapRegions.get(outline);

    if (!regionsForOutline) {
      regionsForOutline = new Map();
      overlapRegions.set(outline, regionsForOutline);
    }

    let overlapRegion = regionsForOutline.get(otherOutline);

    if (!overlapRegion) {
      const polygon = minkowskiSumOf(
        collisionShapeOf(outline),
        collisionShapeOf(otherOutline).map(({ x, y }) => ({ x: -x, y: -y })),
      );

      overlapRegion = {
        halfPlanes: halfPlanesOf(polygon),
        left: Math.min(...polygon.map(({ x }) => x)),
        right: Math.max(...polygon.map(({ x }) => x)),
        top: Math.min(...polygon.map(({ y }) => y)),
        bottom: Math.max(...polygon.map(({ y }) => y)),
      };
      regionsForOutline.set(otherOutline, overlapRegion);
    }

    return overlapRegion;
  };
}

/**
 * Whether the bounds of `region`, extended right by `reachPx`, overlap the box with corners at `start` and `end`.
 * `false` rules out a collision on the path from `start` to `end` without testing the polygon.
 */
export const isNearRegion = (region: OverlapRegion, reachPx: number, start: Position, end: Position) =>
  Math.min(start.x, end.x) < region.right + reachPx &&
  Math.max(start.x, end.x) > region.left &&
  Math.min(start.y, end.y) < region.bottom &&
  Math.max(start.y, end.y) > region.top;

/**
 * Returns the half-planes of `region`, extended right by `reachPx` to cover the offsets it passes over while moving
 * that far right.
 *
 * Each edge that faces right moves out by `reachPx` times the x component of its normal, and a flat top and bottom join
 * the region's start and end positions. Building the half-planes this way avoids computing the convex hull of the two
 * positions.
 */
export const extendedHalfPlanesOf = ({ halfPlanes, top, bottom }: OverlapRegion, reachPx: number) =>
  reachPx > 0
    ? [
        ...halfPlanes.map(({ normal, offsetPx }) => ({ normal, offsetPx: offsetPx + Math.max(0, normal.x * reachPx) })),
        { normal: { x: 0, y: -1 }, offsetPx: -top },
        { normal: { x: 0, y: 1 }, offsetPx: bottom },
      ]
    : halfPlanes;
