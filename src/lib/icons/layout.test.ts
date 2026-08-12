import { describe, expect, test } from "vitest";

import { positionFromDrop, resolveIconPlacements } from "./layout";

import type { IconLayout, IconPositions } from "./icon";

const LAYOUT: IconLayout = { cellSize: 72, spacing: 96, position: { top: 24, right: 32 } };

const IDS = ["about", "experience", "work", "contact"];

/** The default column: one icon under the next, `spacing` apart. */
const COLUMN: IconPositions = {
  about: { top: 24, right: 32 },
  experience: { top: 120, right: 32 },
  work: { top: 216, right: 32 },
  contact: { top: 312, right: 32 },
};

/** The x of the nth default column, counting leftwards from the right edge of the container. */
function columnX(containerWidth: number, column: number): number {
  return containerWidth - LAYOUT.position.right - LAYOUT.cellSize - column * LAYOUT.spacing;
}

describe("resolveIconPlacements", () => {
  test("projects positions off the right edge when they all fit", () => {
    expect(resolveIconPlacements(IDS, COLUMN, { width: 1000, height: 800 }, LAYOUT)).toEqual([
      { id: "about", x: columnX(1000, 0), y: 24 },
      { id: "experience", x: columnX(1000, 0), y: 120 },
      { id: "work", x: columnX(1000, 0), y: 216 },
      { id: "contact", x: columnX(1000, 0), y: 312 },
    ]);
  });

  test("starts a new column for icons the container is too short to hold", () => {
    // Only the first two icons fit: the third would end at 216 + 72 = 288.
    expect(resolveIconPlacements(IDS, COLUMN, { width: 1000, height: 280 }, LAYOUT)).toEqual([
      { id: "about", x: columnX(1000, 0), y: 24 },
      { id: "experience", x: columnX(1000, 0), y: 120 },
      { id: "work", x: columnX(1000, 1), y: 24 },
      { id: "contact", x: columnX(1000, 1), y: 120 },
    ]);
  });

  test("slots icons pushed off the left edge instead of clamping them to it", () => {
    const spread: IconPositions = {
      about: { top: 24, right: 32 },
      experience: { top: 24, right: 400 },
      work: { top: 24, right: 500 },
      contact: { top: 120, right: 32 },
    };

    /* A container 300 wide leaves room for the first column only, so the two icons
     * anchored far from the right edge fall in below the two that still fit. */
    expect(resolveIconPlacements(IDS, spread, { width: 300, height: 800 }, LAYOUT)).toEqual([
      { id: "about", x: columnX(300, 0), y: 24 },
      { id: "experience", x: columnX(300, 0), y: 216 },
      { id: "work", x: columnX(300, 0), y: 312 },
      { id: "contact", x: columnX(300, 0), y: 120 },
    ]);
  });

  test("skips a slot a free-form icon already covers", () => {
    const positions: IconPositions = {
      about: { top: 24, right: 32 },
      experience: { top: 60, right: 128 }, // Straddles both usable slots of the second column.
      work: { top: 216, right: 32 },
      contact: { top: 312, right: 32 },
    };

    // `contact` skips past the blocked second column into a third.
    expect(resolveIconPlacements(IDS, positions, { width: 1000, height: 280 }, LAYOUT)).toEqual([
      { id: "about", x: columnX(1000, 0), y: 24 },
      { id: "experience", x: columnX(1000, 1), y: 60 },
      { id: "work", x: columnX(1000, 0), y: 120 },
      { id: "contact", x: columnX(1000, 2), y: 24 },
    ]);
  });

  test("leaves icons the visitor stacked themselves alone", () => {
    const stacked: IconPositions = {
      about: { top: 24, right: 32 },
      experience: { top: 40, right: 48 },
      work: { top: 216, right: 32 },
      contact: { top: 312, right: 32 },
    };

    const placements = resolveIconPlacements(IDS, stacked, { width: 1000, height: 800 }, LAYOUT);

    expect(placements[0]).toEqual({ id: "about", x: columnX(1000, 0), y: 24 });
    expect(placements[1]).toEqual({ id: "experience", x: 880, y: 40 }); // 1000 - 48 - cellSize: its own anchor, not a column.
  });

  test("passes positions through untouched before the container has been measured", () => {
    expect(resolveIconPlacements(IDS, COLUMN, { width: 0, height: 0 }, LAYOUT)).toEqual([
      { id: "about", x: columnX(0, 0), y: 24 },
      { id: "experience", x: columnX(0, 0), y: 120 },
      { id: "work", x: columnX(0, 0), y: 216 },
      { id: "contact", x: columnX(0, 0), y: 312 },
    ]);
  });

  test("keeps icons on screen when the container has no free slot left", () => {
    const placements = resolveIconPlacements(IDS, COLUMN, { width: 120, height: 120 }, LAYOUT);

    for (const placement of placements) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.x).toBeLessThanOrEqual(120 - LAYOUT.cellSize);
      expect(placement.y).toBeGreaterThanOrEqual(0);
      expect(placement.y).toBeLessThanOrEqual(120 - LAYOUT.cellSize);
    }
  });

  test("drops ids that have no position", () => {
    expect(resolveIconPlacements(IDS, { about: { top: 24, right: 32 } }, { width: 1000, height: 800 }, LAYOUT)).toEqual(
      [{ id: "about", x: columnX(1000, 0), y: 24 }],
    );
  });
});

describe("positionFromDrop", () => {
  const CONTAINER = { width: 1000, height: 800 };

  test("anchors a drop to the right edge", () => {
    expect(positionFromDrop({ x: 800, y: 120 }, CONTAINER, LAYOUT)).toEqual({ top: 120, right: 128 });
  });

  test("round trips with the projection", () => {
    const position = positionFromDrop({ x: columnX(1000, 1), y: 120 }, CONTAINER, LAYOUT);

    expect(resolveIconPlacements(["about"], { about: position }, CONTAINER, LAYOUT)).toEqual([
      { id: "about", x: columnX(1000, 1), y: 120 },
    ]);
  });

  test("holds a drop past an edge inside the container, so it is not read as pushed out", () => {
    const dropped = positionFromDrop({ x: -40, y: -20 }, CONTAINER, LAYOUT);

    expect(dropped).toEqual({ top: 0, right: 928 });
    expect(resolveIconPlacements(["about"], { about: dropped }, CONTAINER, LAYOUT)).toEqual([
      { id: "about", x: 0, y: 0 },
    ]);
  });

  test("holds a drop past the far edges too", () => {
    expect(positionFromDrop({ x: 1200, y: 900 }, CONTAINER, LAYOUT)).toEqual({ top: 728, right: 0 });
  });
});
