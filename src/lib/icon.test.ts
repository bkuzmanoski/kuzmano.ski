import { afterEach, describe, expect, test } from "vitest";

import { isValidPosition, loadPositions, nextIconId, savePositions } from "./icon";

import type { IconLayout, IconPositions } from "./icon";

const IDS = ["about", "work", "contact"];
const LAYOUT: IconLayout = { cellSize: 76, spacing: 84, position: { top: 24, right: 28 } };
const STORAGE_KEY = "test-icon-positions";

afterEach(() => localStorage.clear());

function everyPositionIsValid(positions: IconPositions): boolean {
  return IDS.every((id) => isValidPosition(positions[id]));
}

describe("loadPositions", () => {
  test("stacks the icons down a column when nothing is saved", () => {
    const positions = loadPositions(IDS, LAYOUT, STORAGE_KEY);

    expect(Object.keys(positions)).toEqual(IDS);
    expect(positions.about).toEqual(LAYOUT.position);
    expect(positions.work).toEqual({ top: LAYOUT.position.top + LAYOUT.spacing, right: LAYOUT.position.right });
  });

  test("uses a saved position", () => {
    savePositions({ about: { top: 120, right: 120 } }, STORAGE_KEY);
    expect(loadPositions(IDS, LAYOUT, STORAGE_KEY).about).toEqual({ top: 120, right: 120 });
  });

  test("corrupt values fall back to the defaults", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ about: null, work: "invalid", contact: { top: 0, right: "invalid" } }),
    );
    expect(everyPositionIsValid(loadPositions(IDS, LAYOUT, STORAGE_KEY))).toBe(true);
  });

  test("unparsable storage falls back to the defaults", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(everyPositionIsValid(loadPositions(IDS, LAYOUT, STORAGE_KEY))).toBe(true);
  });

  test("an unknown saved id is ignored", () => {
    savePositions({ "not-an-icon": { top: 0, right: 0 } }, STORAGE_KEY);
    expect(Object.keys(loadPositions(IDS, LAYOUT, STORAGE_KEY))).toEqual(IDS);
  });
});

describe("nextIconId", () => {
  test("steps through the icons and wraps at both ends", () => {
    expect(nextIconId(IDS, "about", 1)).toBe("work");
    expect(nextIconId(IDS, "about", -1)).toBe("contact");
    expect(nextIconId(IDS, "contact", 1)).toBe("about");
  });
});
