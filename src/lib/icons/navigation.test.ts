import { describe, expect, test } from "vitest";

import { adjacentIconId } from "./navigation.ts";

import type { IconPlacement } from "./icon.ts";

const ICON_PLACEMENTS: Array<IconPlacement> = [
  { id: "top-left", x: 0, y: 0 },
  { id: "top-right", x: 100, y: 0 },
  { id: "bottom-left", x: 0, y: 100 },
  { id: "bottom-right", x: 100, y: 100 },
];

describe("adjacentIconId", () => {
  test("returns the id of the icon in the given direction", () => {
    expect(adjacentIconId(ICON_PLACEMENTS, "top-left", "ArrowRight")).toBe("top-right");
    expect(adjacentIconId(ICON_PLACEMENTS, "top-left", "ArrowDown")).toBe("bottom-left");
    expect(adjacentIconId(ICON_PLACEMENTS, "bottom-right", "ArrowLeft")).toBe("bottom-left");
    expect(adjacentIconId(ICON_PLACEMENTS, "bottom-right", "ArrowUp")).toBe("top-right");
  });

  test("returns null when there is no neighbour in a given direction", () => {
    expect(adjacentIconId(ICON_PLACEMENTS, "top-left", "ArrowUp")).toBeNull();
    expect(adjacentIconId(ICON_PLACEMENTS, "top-left", "ArrowLeft")).toBeNull();
    expect(adjacentIconId(ICON_PLACEMENTS, "bottom-right", "ArrowDown")).toBeNull();
    expect(adjacentIconId(ICON_PLACEMENTS, "bottom-right", "ArrowRight")).toBeNull();
  });

  test("returns null when there is no neighbour in a single-column layout", () => {
    const column = [
      { id: "top", x: 0, y: 0 },
      { id: "bottom", x: 0, y: 100 },
    ];

    expect(adjacentIconId(column, "top", "ArrowRight")).toBeNull();
    expect(adjacentIconId(column, "top", "ArrowDown")).toBe("bottom");
  });

  test("returns the closest neighbour when there are multiple in a given direction", () => {
    const placements = [
      { id: "start", x: 0, y: 0 },
      { id: "nearer-off-axis", x: 30, y: 60 },
      { id: "farther-on-axis", x: 0, y: 80 },
    ];
    expect(adjacentIconId(placements, "start", "ArrowDown")).toBe("farther-on-axis");
  });

  test("returns null when the given id is not in the placements", () => {
    expect(adjacentIconId(ICON_PLACEMENTS, "not-an-icon", "ArrowDown")).toBeNull();
  });
});
