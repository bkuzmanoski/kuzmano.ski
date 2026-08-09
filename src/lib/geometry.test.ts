import { describe, expect, test } from "vitest";

import { constrain, insetRect, insetToViewport, scaleInset } from "./geometry";

import type { Inset, Rect, Size } from "./geometry";

const containerSize: Size = { width: 1000, height: 800 };
const rect: Rect = { x: 100, y: 50, width: 400, height: 300 };
const inset: Inset = { top: 28, right: 24, bottom: 28, left: 24 };

describe("constrain", () => {
  test("returns a rect unchanged when it already fits", () => {
    expect(constrain(rect, containerSize)).toEqual(rect);
  });

  test("clamps size to the container", () => {
    expect(constrain({ x: 0, y: 0, width: 1400, height: 1200 }, containerSize)).toEqual({
      x: 0,
      y: 0,
      ...containerSize,
    });
  });

  test("clamps position to keep the rect in bounds, without changing size", () => {
    expect(constrain({ ...rect, x: 900, y: 700 }, containerSize)).toEqual({ x: 600, y: 500, width: 400, height: 300 });
  });

  test("clamps a negative position to zero", () => {
    expect(constrain({ ...rect, x: -50, y: -20 }, containerSize)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  test("recomputes constraints as the container is resized", () => {
    const smallContainer: Size = { width: 300, height: 200 };

    expect(constrain(rect, smallContainer)).toEqual({ x: 0, y: 0, ...smallContainer });
    expect(constrain(rect, containerSize)).toEqual(rect);
  });

  test("returns the rect unchanged when the container is unmeasured", () => {
    expect(constrain(rect, { width: 0, height: 0 })).toEqual(rect);
  });
});

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

  test("leaves the box centred when the inset is symmetric", () => {
    const inner = insetRect(rect, inset);

    expect(inner.x + inner.width / 2).toBeCloseTo(rect.x + rect.width / 2);
    expect(inner.y + inner.height / 2).toBeCloseTo(rect.y + rect.height / 2);
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
