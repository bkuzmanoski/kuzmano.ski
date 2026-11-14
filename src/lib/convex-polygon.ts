import type { Position } from "./geometry.ts";

/** A convex polygon, as its vertices in clockwise order where y increases downward, without collinear vertices. */
export type ConvexPolygon = ReadonlyArray<Position>;

/** The inside of one edge of a convex polygon, the points `p` at which `normal · p` is at most `offsetPx`. */
export interface HalfPlane {
  /** The edge's outward unit normal. */
  normal: Position;
  offsetPx: number;
}

/** The z component of the cross product of `a - origin` and `b - origin`, positive where `b` is clockwise from `a`. */
const crossProductOf = (origin: Position, a: Position, b: Position) =>
  (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

/** Returns the smallest convex polygon that contains `points`. */
export function convexHullOf(points: ReadonlyArray<Position>): ConvexPolygon {
  const sortedPoints = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  // Andrew's monotone chain builds each half of the hull in one pass over the sorted points.
  const halfHullOf = (orderedPoints: ReadonlyArray<Position>) => {
    const halfHull: Array<Position> = [];

    for (const point of orderedPoints) {
      while (halfHull.length >= 2 && crossProductOf(halfHull.at(-2)!, halfHull.at(-1)!, point) <= 0) {
        halfHull.pop();
      }

      halfHull.push(point);
    }

    return halfHull.slice(0, -1);
  };

  if (sortedPoints.length < 3) {
    return sortedPoints;
  }

  return [...halfHullOf(sortedPoints), ...halfHullOf([...sortedPoints].reverse())];
}

/** Returns the set of sums of a point in `a` and a point in `b`. */
export const minkowskiSumOf = (a: ConvexPolygon, b: ConvexPolygon): ConvexPolygon =>
  convexHullOf(a.flatMap((aVertex) => b.map((bVertex) => ({ x: aVertex.x + bVertex.x, y: aVertex.y + bVertex.y }))));

/** Returns the half-planes inside the edges of `polygon`, which intersect in `polygon`. */
export function halfPlanesOf(polygon: ConvexPolygon): ReadonlyArray<HalfPlane> {
  return polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const normal = { x: (end.y - start.y) / length, y: (start.x - end.x) / length };

    return { normal, offsetPx: normal.x * start.x + normal.y * start.y };
  });
}

/**
 * Returns how far `point` lies inside the polygon in which `halfPlanes` intersect, measured to its nearest edge, and
 * negative outside it.
 */
export const depthOf = (halfPlanes: ReadonlyArray<HalfPlane>, point: Position) =>
  Math.min(...halfPlanes.map(({ normal, offsetPx }) => offsetPx - normal.x * point.x - normal.y * point.y));

/**
 * Returns the distance from `start`, along the unit vector `direction`, to the first point more than `marginPx` inside
 * the polygon in which `halfPlanes` intersect. Returns `Infinity` if the path never reaches that depth, or `null` if it
 * reached that depth more than `marginPx` before `start`.
 *
 * Returns `0` when `start` is less than `marginPx` past the entry point. This lets a point positioned at a previous
 * entry point re-enter at `0`, despite floating-point imprecision. Likewise, a path parallel to an edge and less than
 * `marginPx` past it returns `Infinity`, allowing the point to move along the edge.
 */
export function entryDistanceOf(
  halfPlanes: ReadonlyArray<HalfPlane>,
  start: Position,
  direction: Position,
  marginPx: number,
) {
  // The Cyrus–Beck algorithm clips the path to each half-plane in turn.
  let entryDistance = -Infinity;
  let exitDistance = Infinity;

  for (const { normal, offsetPx } of halfPlanes) {
    const outsideDistance = normal.x * start.x + normal.y * start.y - offsetPx + marginPx;
    const approachRate = normal.x * direction.x + normal.y * direction.y;

    if (Math.abs(approachRate) < 1e-12) {
      if (outsideDistance > -marginPx) {
        return Infinity;
      }
    } else if (approachRate < 0) {
      entryDistance = Math.max(entryDistance, -outsideDistance / approachRate);
    } else {
      exitDistance = Math.min(exitDistance, -outsideDistance / approachRate);
    }
  }

  if (entryDistance >= exitDistance || exitDistance <= 0) {
    return Infinity;
  }

  return entryDistance < -marginPx ? null : Math.max(0, entryDistance);
}
