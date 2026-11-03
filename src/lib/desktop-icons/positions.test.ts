import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ICON_POSITIONS_STORAGE_KEY, createIconPositionsStore } from "./positions.ts";

import type { IconLayout } from "./icon.ts";

const ICON_IDS = ["first", "second"];
const ICON_LAYOUT: IconLayout = { cellSize: 72, position: { top: 24, right: 32 }, spacing: 96 };

describe("useIconPositions", () => {
  test("gives every configured icon a position", () => {
    const { useIconPositions } = createIconPositionsStore(ICON_IDS, ICON_LAYOUT);
    const { result } = renderHook(() => useIconPositions());

    expect(Object.keys(result.current!)).toEqual(ICON_IDS);
  });

  test("re-renders with the new position after `moveIcon`", () => {
    const { useIconPositions, moveIcon } = createIconPositionsStore(ICON_IDS, ICON_LAYOUT);
    const { result } = renderHook(() => useIconPositions());

    act(() => moveIcon("first", { top: 200, right: 200 }));

    expect(result.current!.first).toEqual({ top: 200, right: 200 });
  });
});

describe("commitIconPositions", () => {
  test("persists every icon position under the storage key", () => {
    const { useIconPositions, moveIcon, commitIconPositions } = createIconPositionsStore(ICON_IDS, ICON_LAYOUT);
    renderHook(() => useIconPositions());

    act(() => moveIcon("first", { top: 320, right: 320 }));
    commitIconPositions();

    const savedPositions = JSON.parse(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY) ?? "{}") as Record<
      string,
      unknown
    >;

    expect(Object.keys(savedPositions)).toEqual(ICON_IDS);
    expect(savedPositions.first).toEqual({ top: 320, right: 320 });
  });
});

describe("resetIconPositions", () => {
  test("removes the saved positions from local storage, and makes `useIconPositions` return the default positions", () => {
    const { useIconPositions, moveIcon, commitIconPositions, resetIconPositions } = createIconPositionsStore(
      ICON_IDS,
      ICON_LAYOUT,
    );
    const { result } = renderHook(() => useIconPositions());
    const defaultFirstPosition = result.current!.first;

    act(() => moveIcon("first", { top: 320, right: 320 }));
    commitIconPositions();

    expect(result.current!.first).toEqual({ top: 320, right: 320 });
    expect(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY)).not.toBeNull();

    act(() => resetIconPositions());

    expect(result.current!.first).toEqual(defaultFirstPosition);
    expect(localStorage.getItem(ICON_POSITIONS_STORAGE_KEY)).toBeNull();
  });
});
