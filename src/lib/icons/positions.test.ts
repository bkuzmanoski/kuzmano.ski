import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { createIconPositionsStore } from "./positions";

import type { IconLayout } from "./icon";

const IDS = ["first", "second"];
const LAYOUT: IconLayout = { cellSize: 72, position: { top: 24, right: 32 }, spacing: 96 };
const STORAGE_KEY = "test-icon-positions";

describe("useIconPositions", () => {
  test("gives every configured icon a position", () => {
    const { useIconPositions } = createIconPositionsStore(IDS, LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useIconPositions());

    expect(Object.keys(result.current!)).toEqual(IDS);
  });

  test("a move re-renders subscribers with the new position", () => {
    const { useIconPositions, moveIcon } = createIconPositionsStore(IDS, LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useIconPositions());

    act(() => moveIcon("first", { top: 200, right: 200 }));

    expect(result.current!.first).toEqual({ top: 200, right: 200 });
  });
});

describe("commitIconPositions", () => {
  test("persists the whole layout under the storage key", () => {
    const { useIconPositions, moveIcon, commitIconPositions } = createIconPositionsStore(IDS, LAYOUT, STORAGE_KEY);
    renderHook(() => useIconPositions());

    act(() => moveIcon("first", { top: 320, right: 320 }));
    commitIconPositions();

    const savedPositions = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;

    expect(Object.keys(savedPositions)).toEqual(IDS);
    expect(savedPositions.first).toEqual({ top: 320, right: 320 });
  });
});
