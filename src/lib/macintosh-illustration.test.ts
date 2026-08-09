import { describe, expect, test } from "vitest";

import { viewableAreaOf } from "./macintosh-illustration";

describe("viewableAreaOf", () => {
  // Note: The display cutout is 554x410 at (330, 99) in the 1214x1067 illustration.

  test("maps the illustration at its own size to the cutout", () => {
    const area = viewableAreaOf({ x: 0, y: 0, width: 1214, height: 1067 });

    expect(area.x).toBeCloseTo(330);
    expect(area.y).toBeCloseTo(99);
    expect(area.width).toBeCloseTo(554);
    expect(area.height).toBeCloseTo(410);
  });

  test("scales with the illustration", () => {
    const area = viewableAreaOf({ x: 0, y: 0, width: 607, height: 533.5 });

    expect(area.x).toBeCloseTo(165);
    expect(area.y).toBeCloseTo(49.5);
    expect(area.width).toBeCloseTo(277);
    expect(area.height).toBeCloseTo(205);
  });

  test("follows the illustration's position in the viewport", () => {
    const area = viewableAreaOf({ x: 100, y: 40, width: 1214, height: 1067 });

    expect(area.x).toBeCloseTo(430);
    expect(area.y).toBeCloseTo(139);
  });

  test("stays inside the illustration", () => {
    const box = { x: 0, y: 0, width: 900, height: 791 };
    const area = viewableAreaOf(box);

    expect(area.x).toBeGreaterThan(0);
    expect(area.y).toBeGreaterThan(0);
    expect(area.x + area.width).toBeLessThan(box.width);
    expect(area.y + area.height).toBeLessThan(box.height);
  });
});
