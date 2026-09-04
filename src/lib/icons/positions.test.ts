import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ICON_POSITIONS_STORAGE_KEY, createIconPositionsStore } from "./positions.ts";

import type { IconLayout } from "./icon.ts";

const IDS = ["first", "second"];
const LAYOUT: IconLayout = { cellSize: 72, position: { top: 24, right: 32 }, spacing: 96 };

describe("useIconPositions", () => {
  test("gives every configured icon a position", () => {
    const { useIconPositions } = createIconPositionsStore(IDS, LAYOUT);
    const { result } = renderHook(() => useIconPositions());

    expect(Object.keys(result.current!)).toEqual(IDS);
  });

  test("a move re-renders subscribers with the new position", () => {
    const { useIconPositions, moveIcon } = createIconPositionsStore(IDS, LAYOUT);
    const { result } = renderHook(() => useIconPositions());

    act(() => moveIcon("first", { top: 200, right: 200 }));

    expect(result.current!.first).toEqual({ top: 200, right: 200 });
  });
});

describe("commitIconPositions", () => {
  test("persists the whole layout under the storage key", () => {
    const { useIconPositions, moveIcon, commitIconPositions } = createIconPositionsStore(IDS, LAYOUT);
    renderHook(() => useIconPositions());

    act(() => moveIcon("first", { top: 320, right: 320 }));
    commitIconPositions();

    const savedPositions = JSON.parse(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY) ?? "{}") as Record<
      string,
      unknown
    >;

    expect(Object.keys(savedPositions)).toEqual(IDS);
    expect(savedPositions.first).toEqual({ top: 320, right: 320 });
  });
});
