import { describe, expect, test } from "vitest";

import { isValidPosition, loadPositions, savePositions } from "./icon";

import type { IconLayout, IconPositions } from "./icon";

const STORAGE_KEY = "test-icon-positions";
const IDS = ["about", "experience", "work", "contact"];
const LAYOUT: IconLayout = { cellSize: 76, spacing: 84, position: { top: 24, right: 28 } };

function everyPositionIsValid(positions: IconPositions): boolean {
  return IDS.every((id) => isValidPosition(positions[id]));
}

describe("loadPositions", () => {
  test("stacks icons vertically when no positions are saved", () => {
    const positions = loadPositions(IDS, LAYOUT, STORAGE_KEY);

    expect(Object.keys(positions)).toEqual(IDS);
    expect(positions.about).toEqual(LAYOUT.position);
    expect(positions.experience).toEqual({ top: LAYOUT.position.top + LAYOUT.spacing, right: LAYOUT.position.right });
  });

  test("uses a saved position", () => {
    savePositions({ about: { top: 120, right: 120 } }, STORAGE_KEY);
    expect(loadPositions(IDS, LAYOUT, STORAGE_KEY).about).toEqual({ top: 120, right: 120 });
  });

  test("ignores a saved position with an invalid value", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ about: null, work: "invalid", contact: { top: 0, right: "invalid" } }),
    );
    expect(everyPositionIsValid(loadPositions(IDS, LAYOUT, STORAGE_KEY))).toBe(true);
  });

  test("ignores a saved position that is unparseable", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(everyPositionIsValid(loadPositions(IDS, LAYOUT, STORAGE_KEY))).toBe(true);
  });

  test("ignores a saved position for an unknown icon", () => {
    savePositions({ "not-an-icon": { top: 0, right: 0 } }, STORAGE_KEY);
    expect(Object.keys(loadPositions(IDS, LAYOUT, STORAGE_KEY))).toEqual(IDS);
  });
});
