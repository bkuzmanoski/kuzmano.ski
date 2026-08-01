import { afterEach, describe, expect, test } from "vitest";

import { ICONS, ICON_IDS, ICON_LAYOUT } from "#/config/icons";
import { ICON_POSITIONS_STORAGE_KEY } from "#/lib/icon";

import { isValidPosition, loadPositions, nextIconId, savePositions } from "./icon";

import type { IconPosition } from "./icon";

afterEach(() => localStorage.clear());

function everyPositionIsValid(positions: Record<string, IconPosition>): boolean {
  return ICONS.every((iconDefinition) => {
    const position = positions[iconDefinition.id];
    return isValidPosition(position);
  });
}

describe("loadPositions", () => {
  test("returns a finite default for every icon when nothing is saved", () => {
    const positions = loadPositions(ICON_IDS, ICON_LAYOUT, ICON_POSITIONS_STORAGE_KEY);

    expect(Object.keys(positions)).toHaveLength(ICONS.length);
    expect(everyPositionIsValid(positions)).toBe(true);
  });

  test("uses a saved position", () => {
    savePositions({ about: { top: 120, right: 120 } }, ICON_POSITIONS_STORAGE_KEY);
    expect(loadPositions(ICON_IDS, ICON_LAYOUT, ICON_POSITIONS_STORAGE_KEY).about).toEqual({ top: 120, right: 120 });
  });

  test("corrupt values fall back to the defaults", () => {
    localStorage.setItem(
      ICON_POSITIONS_STORAGE_KEY,
      JSON.stringify({ about: null, work: "invalid", contact: { top: 0, right: "invalid" } }),
    );
    expect(everyPositionIsValid(loadPositions(ICON_IDS, ICON_LAYOUT, ICON_POSITIONS_STORAGE_KEY))).toBe(true);
  });

  test("unparsable storage falls back to the defaults", () => {
    localStorage.setItem(ICON_POSITIONS_STORAGE_KEY, "not-json");
    expect(everyPositionIsValid(loadPositions(ICON_IDS, ICON_LAYOUT, ICON_POSITIONS_STORAGE_KEY))).toBe(true);
  });

  test("an unknown saved id is ignored", () => {
    savePositions({ "not-an-icon": { top: 0, right: 0 } }, ICON_POSITIONS_STORAGE_KEY);
    expect(Object.keys(loadPositions(ICON_IDS, ICON_LAYOUT, ICON_POSITIONS_STORAGE_KEY))).toEqual(
      ICONS.map((iconDefinition) => iconDefinition.id),
    );
  });
});

describe("nextIconId", () => {
  test("steps through the icons and wraps at both ends", () => {
    const [firstIcon, secondIcon] = ICONS;
    const lastIcon = ICONS.at(-1)!;

    expect(nextIconId(ICON_IDS, firstIcon!.id, 1)).toBe(secondIcon!.id);
    expect(nextIconId(ICON_IDS, firstIcon!.id, -1)).toBe(lastIcon.id);
    expect(nextIconId(ICON_IDS, lastIcon.id, 1)).toBe(firstIcon!.id);
  });
});
