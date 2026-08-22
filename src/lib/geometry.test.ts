import { describe, expect, test } from "vitest";

import { insetRect, insetToViewport, scaleInset, transformBetween } from "./geometry";

import type { Inset, Rect, Transform } from "./geometry";

const rect: Rect = { x: 100, y: 50, width: 400, height: 300 };
const inset: Inset = { top: 28, right: 24, bottom: 28, left: 24 };

describe("scaleInset", () => {
  test("scales every edge", () => {
    expect(scaleInset(inset, 0.5)).toEqual({ top: 14, right: 12, bottom: 14, left: 12 });
  });

  test("a scale of one leaves the inset alone", () => {
    expect(scaleInset(inset, 1)).toEqual(inset);
  });

  test("carries the sign of an edge that reaches past its container", () => {
    expect(scaleInset({ top: -100, right: -200, bottom: 0, left: 50 }, 2)).toEqual({
      top: -200,
      right: -400,
      bottom: 0,
      left: 100,
    });
  });
});

describe("insetRect", () => {
  test("takes each edge off the corresponding side", () => {
    expect(insetRect(rect, inset)).toEqual({ x: 124, y: 78, width: 352, height: 244 });
  });

  test("leaves the box centered when the inset is symmetric", () => {
    const innerRect = insetRect(rect, inset);

    expect(innerRect.x + innerRect.width / 2).toBeCloseTo(rect.x + rect.width / 2);
    expect(innerRect.y + innerRect.height / 2).toBeCloseTo(rect.y + rect.height / 2);
  });

  test("a zero inset returns the rect itself", () => {
    expect(insetRect(rect, { top: 0, right: 0, bottom: 0, left: 0 })).toEqual(rect);
  });

  test("grows the rect for a negative inset, which is what reaching out to the viewport is", () => {
    expect(
      insetRect({ x: 100, y: 50, width: 400, height: 300 }, { top: -50, right: -100, bottom: -450, left: -100 }),
    ).toEqual({ x: 0, y: 0, width: 600, height: 800 });
  });
});

describe("insetToViewport", () => {
  const viewport = { width: 1000, height: 800 };

  test("returns distance from the box to the viewport for each edge", () => {
    expect(insetToViewport({ x: 300, y: 100, width: 500, height: 400 }, viewport)).toEqual({
      top: -100,
      right: -200,
      bottom: -300,
      left: -300,
    });
  });

  test("returns zero for every edge of a box that fills the viewport", () => {
    const insetBox = insetToViewport({ x: 0, y: 0, width: 1000, height: 800 }, viewport);
    expect(Object.values(insetBox).every((edge) => edge === 0)).toBe(true); // Compared as numbers: a zero edge can come out signed, which CSS does not mind.
  });

  test("returns edges that place the box on the viewport edges", () => {
    const box = { x: 330, y: 99, width: 554, height: 410 };
    const edges = insetToViewport(box, viewport);

    expect(box.y + edges.top).toBe(0);
    expect(box.x + edges.left).toBe(0);
    expect(box.x + box.width - edges.right).toBe(viewport.width);
    expect(box.y + box.height - edges.bottom).toBe(viewport.height);
  });
});

describe("transformBetween", () => {
  const apply = ({ scale, x, y }: Transform, box: Rect): Rect => ({
    x: box.x * scale + x,
    y: box.y * scale + y,
    width: box.width * scale,
    height: box.height * scale,
  });

  const originalRect: Rect = { x: 200, y: 150, width: 400, height: 300 };
  const targetRect: Rect = { x: 50, y: 25, width: 800, height: 600 };

  test("transforms the original rect to the target rect", () => {
    expect(apply(transformBetween(originalRect, targetRect), originalRect)).toEqual(targetRect);
  });

  test("transforms a child rect of the original rect to the corresponding position and size in the target rect", () => {
    const childRect: Rect = { x: 300, y: 250, width: 100, height: 100 }; // Offset by 100, 100 inside `originalRect`.
    const transformedRect = apply(transformBetween(originalRect, targetRect), childRect);

    expect(transformedRect.x - targetRect.x).toBeCloseTo(200); // The offset doubles with the rect.
    expect(transformedRect.y - targetRect.y).toBeCloseTo(200);
    expect(transformedRect.width).toBeCloseTo(200);
    expect(transformedRect.height).toBeCloseTo(200);
  });

  test("is the identity between a rect and itself", () => {
    expect(transformBetween(originalRect, originalRect)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  test("holds a scale of one for an unmeasured rect", () => {
    expect(transformBetween({ x: 0, y: 0, width: 0, height: 0 }, targetRect)).toEqual({
      scale: 1,
      x: targetRect.x,
      y: targetRect.y,
    });
  });
});
