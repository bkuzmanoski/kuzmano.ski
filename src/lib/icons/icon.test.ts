import { describe, expect, test } from "vitest";

import { isValidPosition, loadPositions, savePositions } from "./icon.ts";

import type { IconLayout, IconPositions } from "./icon.ts";

const STORAGE_KEY = "test-icon-positions";
const ICON_IDS = ["first", "second", "third", "fourth"];
const ICON_LAYOUT: IconLayout = { cellSize: 76, spacing: 84, position: { top: 24, right: 28 } };

function everyPositionIsValid(positions: IconPositions): boolean {
  return ICON_IDS.every((id) => isValidPosition(positions[id]));
}

describe("loadPositions", () => {
  test("stacks icons vertically when no positions are saved", () => {
    const positions = loadPositions(ICON_IDS, ICON_LAYOUT, STORAGE_KEY);

    expect(Object.keys(positions)).toEqual(ICON_IDS);
    expect(positions.first).toEqual(ICON_LAYOUT.position);
    expect(positions.second).toEqual({
      top: ICON_LAYOUT.position.top + ICON_LAYOUT.spacing,
      right: ICON_LAYOUT.position.right,
    });
  });

  test("uses a saved position", () => {
    savePositions({ first: { top: 120, right: 120 } }, STORAGE_KEY);
    expect(loadPositions(ICON_IDS, ICON_LAYOUT, STORAGE_KEY).first).toEqual({ top: 120, right: 120 });
  });

  test("ignores a saved position with an invalid value", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ first: null, third: "invalid", fourth: { top: 0, right: "invalid" } }),
    );
    expect(everyPositionIsValid(loadPositions(ICON_IDS, ICON_LAYOUT, STORAGE_KEY))).toBe(true);
  });

  test("ignores a saved position that is unparseable", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(everyPositionIsValid(loadPositions(ICON_IDS, ICON_LAYOUT, STORAGE_KEY))).toBe(true);
  });

  test("ignores a saved position for an unknown icon", () => {
    savePositions({ "not-an-icon": { top: 0, right: 0 } }, STORAGE_KEY);
    expect(Object.keys(loadPositions(ICON_IDS, ICON_LAYOUT, STORAGE_KEY))).toEqual(ICON_IDS);
  });
});
