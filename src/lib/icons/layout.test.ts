import { describe, expect, test } from "vitest";

import { positionFromDrop, resolveIconPlacements } from "./layout";

import type { IconLayout, IconPositions } from "./icon";

const LAYOUT: IconLayout = { cellSize: 72, spacing: 96, position: { top: 24, right: 32 } };
const ICON_IDS = ["first", "second", "third", "fourth"];
const ICON_POSITIONS: IconPositions = {
  first: { top: 24, right: 32 },
  second: { top: 120, right: 32 },
  third: { top: 216, right: 32 },
  fourth: { top: 312, right: 32 },
};

function columnX(containerWidth: number, column: number): number {
  return containerWidth - LAYOUT.position.right - LAYOUT.cellSize - column * LAYOUT.spacing;
}

describe("resolveIconPlacements", () => {
  test("projects positions off the right edge when they all fit", () => {
    expect(resolveIconPlacements(ICON_IDS, ICON_POSITIONS, { width: 1000, height: 800 }, LAYOUT)).toEqual([
      { id: "first", x: columnX(1000, 0), y: 24 },
      { id: "second", x: columnX(1000, 0), y: 120 },
      { id: "third", x: columnX(1000, 0), y: 216 },
      { id: "fourth", x: columnX(1000, 0), y: 312 },
    ]);
  });

  test("starts a new column for icons the container is too short to hold", () => {
    // Only the first two icons fit: the third would end at 216 + 72 = 288.
    expect(resolveIconPlacements(ICON_IDS, ICON_POSITIONS, { width: 1000, height: 280 }, LAYOUT)).toEqual([
      { id: "first", x: columnX(1000, 0), y: 24 },
      { id: "second", x: columnX(1000, 0), y: 120 },
      { id: "third", x: columnX(1000, 1), y: 24 },
      { id: "fourth", x: columnX(1000, 1), y: 120 },
    ]);
  });

  test("places icons pushed off the left edge into a slot instead of clamping them to it", () => {
    const iconPositions: IconPositions = {
      first: { top: 24, right: 32 },
      second: { top: 24, right: 400 },
      third: { top: 24, right: 500 },
      fourth: { top: 120, right: 32 },
    };

    // A container 300 wide leaves room for the first column only, so the two icons
    // anchored far from the right edge fall in below the two that still fit.
    expect(resolveIconPlacements(ICON_IDS, iconPositions, { width: 300, height: 800 }, LAYOUT)).toEqual([
      { id: "first", x: columnX(300, 0), y: 24 },
      { id: "second", x: columnX(300, 0), y: 216 },
      { id: "third", x: columnX(300, 0), y: 312 },
      { id: "fourth", x: columnX(300, 0), y: 120 },
    ]);
  });

  test("skips a slot a free-form icon already covers", () => {
    const iconPositions: IconPositions = {
      first: { top: 24, right: 32 },
      second: { top: 60, right: 128 }, // Straddles both usable slots of the second column.
      third: { top: 216, right: 32 },
      fourth: { top: 312, right: 32 },
    };

    expect(resolveIconPlacements(ICON_IDS, iconPositions, { width: 1000, height: 280 }, LAYOUT)).toEqual([
      { id: "first", x: columnX(1000, 0), y: 24 },
      { id: "second", x: columnX(1000, 1), y: 60 },
      { id: "third", x: columnX(1000, 0), y: 120 },
      { id: "fourth", x: columnX(1000, 2), y: 24 },
    ]);
  });

  test("leaves icons the visitor stacked themselves alone", () => {
    const iconPositions: IconPositions = {
      first: { top: 24, right: 32 },
      second: { top: 40, right: 48 },
      third: { top: 216, right: 32 },
      fourth: { top: 312, right: 32 },
    };
    const iconPlacements = resolveIconPlacements(ICON_IDS, iconPositions, { width: 1000, height: 800 }, LAYOUT);

    expect(iconPlacements[0]).toEqual({ id: "first", x: columnX(1000, 0), y: 24 });
    expect(iconPlacements[1]).toEqual({ id: "second", x: 880, y: 40 }); // 1000 - 48 - cellSize: its own anchor, not a column.
  });

  test("skips slot placement and returns raw projected positions when the container is unmeasured (zero size)", () => {
    expect(resolveIconPlacements(ICON_IDS, ICON_POSITIONS, { width: 0, height: 0 }, LAYOUT)).toEqual([
      { id: "first", x: columnX(0, 0), y: 24 },
      { id: "second", x: columnX(0, 0), y: 120 },
      { id: "third", x: columnX(0, 0), y: 216 },
      { id: "fourth", x: columnX(0, 0), y: 312 },
    ]);
  });

  test("keeps icons on screen when the container has no free slot left", () => {
    const placements = resolveIconPlacements(ICON_IDS, ICON_POSITIONS, { width: 120, height: 120 }, LAYOUT);

    for (const placement of placements) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.x).toBeLessThanOrEqual(120 - LAYOUT.cellSize);
      expect(placement.y).toBeGreaterThanOrEqual(0);
      expect(placement.y).toBeLessThanOrEqual(120 - LAYOUT.cellSize);
    }
  });

  test("omits ids that have no position", () => {
    expect(
      resolveIconPlacements(ICON_IDS, { first: { top: 24, right: 32 } }, { width: 1000, height: 800 }, LAYOUT),
    ).toEqual([{ id: "first", x: columnX(1000, 0), y: 24 }]);
  });
});

describe("positionFromDrop", () => {
  const CONTAINER = { width: 1000, height: 800 };

  test("anchors a dropped point to the right edge", () => {
    expect(positionFromDrop({ x: 800, y: 120 }, CONTAINER, LAYOUT)).toEqual({ top: 120, right: 128 });
  });

  test("round trips with the projection", () => {
    const droppedPosition = positionFromDrop({ x: columnX(1000, 1), y: 120 }, CONTAINER, LAYOUT);
    expect(resolveIconPlacements(["first"], { first: droppedPosition }, CONTAINER, LAYOUT)).toEqual([
      { id: "first", x: columnX(1000, 1), y: 120 },
    ]);
  });

  test("clamps a point dropped past the top-left edges to the container bounds, where it still fits without being reassigned to a slot", () => {
    const droppedPosition = positionFromDrop({ x: -40, y: -20 }, CONTAINER, LAYOUT);

    expect(droppedPosition).toEqual({ top: 0, right: 928 });
    expect(resolveIconPlacements(["first"], { first: droppedPosition }, CONTAINER, LAYOUT)).toEqual([
      { id: "first", x: 0, y: 0 },
    ]);
  });

  test("clamps a point dropped past the bottom-right edges to the container bounds", () => {
    expect(positionFromDrop({ x: 1200, y: 900 }, CONTAINER, LAYOUT)).toEqual({ top: 728, right: 0 });
  });
});
