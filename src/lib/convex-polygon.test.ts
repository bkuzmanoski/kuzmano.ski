import { describe, expect, test } from "vitest";

import { convexHullOf, depthOf, entryDistanceOf, halfPlanesOf, minkowskiSumOf } from "./convex-polygon.ts";

import type { ConvexPolygon } from "./convex-polygon.ts";
import type { Position } from "./geometry.ts";

const SQUARE: ConvexPolygon = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];
const SQUARE_HALF_PLANES = halfPlanesOf(SQUARE);
const RIGHT_DIRECTION: Position = { x: 1, y: 0 };
const DOWN_DIRECTION: Position = { x: 0, y: 1 };
const MARGIN_PX = 1e-6;

/**
 * Returns the vertices of `polygon` as a set of `x,y` keys, for comparing polygons without regard to their start
 * vertex.
 */
const vertexKeysOf = (polygon: ConvexPolygon) => new Set(polygon.map(({ x, y }) => `${x},${y}`));

describe("convexHullOf", () => {
  test("returns the corners of points that fill a square, without its interior or edge points", () => {
    const coordinates = Array.from({ length: 11 }, (_, coordinate) => coordinate);
    const points = coordinates.flatMap((x) => coordinates.map((y) => ({ x, y })));

    expect(vertexKeysOf(convexHullOf(points))).toEqual(vertexKeysOf(SQUARE));
  });

  test("returns the vertices in clockwise order, where y increases downward, for points in counterclockwise order", () => {
    const [first, second, third] = convexHullOf([...SQUARE].reverse()) as [Position, Position, Position];
    const crossProduct = (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);

    expect(crossProduct).toBeGreaterThan(0);
  });
});

describe("minkowskiSumOf", () => {
  test("returns the square spanning the sums of two squares", () => {
    expect(vertexKeysOf(minkowskiSumOf(SQUARE, SQUARE))).toEqual(
      vertexKeysOf(SQUARE.map(({ x, y }) => ({ x: x * 2, y: y * 2 }))),
    );
  });
});

describe("halfPlanesOf", () => {
  test("returns the outward unit normal of each edge, with the offset of the edge along it", () => {
    expect(halfPlanesOf(SQUARE)).toEqual([
      { normal: { x: 0, y: -1 }, offsetPx: 0 },
      { normal: { x: 1, y: 0 }, offsetPx: 10 },
      { normal: { x: 0, y: 1 }, offsetPx: 10 },
      { normal: { x: -1, y: 0 }, offsetPx: 0 },
    ]);
  });
});

describe("depthOf", () => {
  test("returns the distance from a point inside to the nearest edge", () => {
    expect(depthOf(SQUARE_HALF_PLANES, { x: 3, y: 5 })).toBeCloseTo(3);
  });

  test("returns the distance to the nearest edge, negated, for a point outside beside that edge", () => {
    expect(depthOf(SQUARE_HALF_PLANES, { x: -2, y: 5 })).toBeCloseTo(-2);
  });
});

describe("entryDistanceOf", () => {
  test("returns the distance along `direction` to the point `marginPx` inside the polygon", () => {
    expect(entryDistanceOf(SQUARE_HALF_PLANES, { x: -4, y: 5 }, RIGHT_DIRECTION, 1)).toBeCloseTo(5);
  });

  test("returns `Infinity` for a path that misses the polygon", () => {
    expect(entryDistanceOf(SQUARE_HALF_PLANES, { x: -4, y: 12 }, RIGHT_DIRECTION, MARGIN_PX)).toBe(Infinity);
  });

  test("returns `Infinity` for a path that leads away from the polygon", () => {
    expect(entryDistanceOf(SQUARE_HALF_PLANES, { x: 14, y: 5 }, RIGHT_DIRECTION, MARGIN_PX)).toBe(Infinity);
  });

  test("returns `Infinity` for a path along an edge", () => {
    expect(entryDistanceOf(SQUARE_HALF_PLANES, { x: -4, y: 10 }, RIGHT_DIRECTION, MARGIN_PX)).toBe(Infinity);
  });

  test("returns `Infinity` for a path parallel to an edge, less than `marginPx` inside it", () => {
    expect(entryDistanceOf(SQUARE_HALF_PLANES, { x: 1.5 * MARGIN_PX, y: -4 }, DOWN_DIRECTION, MARGIN_PX)).toBe(
      Infinity,
    );
  });

  test("returns `0` for a start at the entry point of a previous call", () => {
    const start = { x: -4, y: 5 };
    const entryDistancePx = entryDistanceOf(SQUARE_HALF_PLANES, start, RIGHT_DIRECTION, MARGIN_PX)!;

    expect(
      entryDistanceOf(SQUARE_HALF_PLANES, { x: start.x + entryDistancePx, y: start.y }, RIGHT_DIRECTION, MARGIN_PX),
    ).toBe(0);
  });

  test("returns `null` for a start more than `marginPx` past the entry point", () => {
    expect(entryDistanceOf(SQUARE_HALF_PLANES, { x: 3, y: 5 }, RIGHT_DIRECTION, MARGIN_PX)).toBeNull();
  });
});
