import { describe, expect, test } from "vitest";

import { adjacentIconId } from "./navigation";

import type { IconPlacement } from "./icon";

const ICON_PLACEMENTS: Array<IconPlacement> = [
  { id: "about", x: 0, y: 0 },
  { id: "experience", x: 100, y: 0 },
  { id: "work", x: 0, y: 100 },
  { id: "contact", x: 100, y: 100 },
];

describe("adjacentIconId", () => {
  test("returns the id of the icon in the given direction", () => {
    expect(adjacentIconId(ICON_PLACEMENTS, "about", "ArrowRight")).toBe("experience");
    expect(adjacentIconId(ICON_PLACEMENTS, "about", "ArrowDown")).toBe("work");
    expect(adjacentIconId(ICON_PLACEMENTS, "contact", "ArrowLeft")).toBe("work");
    expect(adjacentIconId(ICON_PLACEMENTS, "contact", "ArrowUp")).toBe("experience");
  });

  test("returns null when there is no neighbour a given direction", () => {
    expect(adjacentIconId(ICON_PLACEMENTS, "about", "ArrowUp")).toBeNull();
    expect(adjacentIconId(ICON_PLACEMENTS, "about", "ArrowLeft")).toBeNull();
    expect(adjacentIconId(ICON_PLACEMENTS, "contact", "ArrowDown")).toBeNull();
    expect(adjacentIconId(ICON_PLACEMENTS, "contact", "ArrowRight")).toBeNull();
  });

  test("returns null when there is no neighbour in a single-column layout", () => {
    const column = [
      { id: "about", x: 0, y: 0 },
      { id: "work", x: 0, y: 100 },
    ];

    expect(adjacentIconId(column, "about", "ArrowRight")).toBeNull();
    expect(adjacentIconId(column, "about", "ArrowDown")).toBe("work");
  });

  test("returns the closest neighbour when there are multiple in a given direction", () => {
    const placements = [
      { id: "about", x: 0, y: 0 },
      { id: "work", x: 30, y: 60 },
      { id: "notes", x: 0, y: 80 },
    ];

    expect(adjacentIconId(placements, "about", "ArrowDown")).toBe("notes");
  });

  test("returns null when the given id is not in the placements", () => {
    expect(adjacentIconId(ICON_PLACEMENTS, "not-an-icon", "ArrowDown")).toBeNull();
  });
});
