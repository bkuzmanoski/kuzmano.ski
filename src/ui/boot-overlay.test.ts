import { describe, expect, test } from "vitest";

import { insetToViewport, viewableAreaOf } from "./boot-overlay";

describe("viewableAreaOf", () => {
  // Note: The display cutout is 554x410 at (330, 99) in the 1214x1067 illustration.

  test("maps the illustration at its own size to the cutout", () => {
    const area = viewableAreaOf({ left: 0, top: 0, width: 1214, height: 1067 });

    expect(area.x).toBeCloseTo(330);
    expect(area.y).toBeCloseTo(99);
    expect(area.width).toBeCloseTo(554);
    expect(area.height).toBeCloseTo(410);
  });

  test("scales with the illustration", () => {
    const area = viewableAreaOf({ left: 0, top: 0, width: 607, height: 533.5 });

    expect(area.x).toBeCloseTo(165);
    expect(area.y).toBeCloseTo(49.5);
    expect(area.width).toBeCloseTo(277);
    expect(area.height).toBeCloseTo(205);
  });

  test("follows the illustration's position in the viewport", () => {
    const area = viewableAreaOf({ left: 100, top: 40, width: 1214, height: 1067 });

    expect(area.x).toBeCloseTo(430);
    expect(area.y).toBeCloseTo(139);
  });

  test("stays inside the illustration", () => {
    const box = { left: 0, top: 0, width: 900, height: 791 };
    const area = viewableAreaOf(box);

    expect(area.x).toBeGreaterThan(0);
    expect(area.y).toBeGreaterThan(0);
    expect(area.x + area.width).toBeLessThan(box.width);
    expect(area.y + area.height).toBeLessThan(box.height);
  });
});

describe("insetToViewport", () => {
  const viewport = { width: 1000, height: 800 };

  test("gives every edge the distance from the box to the viewport", () => {
    expect(insetToViewport({ x: 300, y: 100, width: 500, height: 400 }, viewport)).toEqual({
      top: -100,
      right: -200,
      bottom: -300,
      left: -300,
    });
  });

  test("a box that already fills the viewport does not move", () => {
    const insetBox = insetToViewport({ x: 0, y: 0, width: 1000, height: 800 }, viewport);
    expect(Object.values(insetBox).every((edge) => edge === 0)).toBe(true); // Compared as numbers: a zero edge can come out signed, which CSS does not mind.
  });

  test("the four edges land on the viewport, wherever the box sits", () => {
    const box = { x: 330, y: 99, width: 554, height: 410 };
    const inset = insetToViewport(box, viewport);

    expect(box.y + inset.top).toBe(0);
    expect(box.x + inset.left).toBe(0);
    expect(box.x + box.width - inset.right).toBe(viewport.width);
    expect(box.y + box.height - inset.bottom).toBe(viewport.height);
  });
});
