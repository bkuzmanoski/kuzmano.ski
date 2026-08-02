import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { ICON_IDS } from "#/config/icons";

import { ICON_POSITIONS_STORAGE_KEY, commitIconPositions, moveIcon, useIconPositions } from "./icon-positions";

const FIRST_ICON_ID = ICON_IDS[0]!;

afterEach(() => localStorage.clear());

describe("useIconPositions", () => {
  test("gives every configured icon a position", () => {
    const { result } = renderHook(() => useIconPositions());
    expect(Object.keys(result.current!)).toEqual(ICON_IDS);
  });

  test("a move re-renders subscribers with the new position", () => {
    const { result } = renderHook(() => useIconPositions());

    act(() => moveIcon(FIRST_ICON_ID, { top: 200, right: 200 }));

    expect(result.current![FIRST_ICON_ID]).toEqual({ top: 200, right: 200 });
  });
});

describe("commitIconPositions", () => {
  test("persists the whole layout under the storage key", () => {
    renderHook(() => useIconPositions());

    act(() => moveIcon(FIRST_ICON_ID, { top: 320, right: 320 }));
    commitIconPositions();

    const saved = JSON.parse(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY) ?? "{}") as Record<string, unknown>;

    expect(Object.keys(saved)).toEqual(ICON_IDS);
    expect(saved[FIRST_ICON_ID]).toEqual({ top: 320, right: 320 });
  });
});
