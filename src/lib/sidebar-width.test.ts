import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { createSidebarWidthStore } from "./sidebar-width";

import type { SidebarLayout } from "./sidebar-width";

const LAYOUT: SidebarLayout = { defaultWidth: 240, minWidth: 160, maxWidth: 480 };
const STORAGE_KEY = "test-sidebar-width";

describe("useSidebarWidth", () => {
  test("starts at the default width", () => {
    const { useSidebarWidth } = createSidebarWidthStore(LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useSidebarWidth());

    expect(result.current).toBe(LAYOUT.defaultWidth);
  });

  test("starts at the stored width", () => {
    localStorage.setItem(STORAGE_KEY, "320");

    const { useSidebarWidth } = createSidebarWidthStore(LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useSidebarWidth());

    expect(result.current).toBe(320);
  });

  test("falls back to the default width when the stored one is not a width", () => {
    localStorage.setItem(STORAGE_KEY, "invalid-width");

    const { useSidebarWidth } = createSidebarWidthStore(LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useSidebarWidth());

    expect(result.current).toBe(LAYOUT.defaultWidth);
  });

  test("holds a stored width within the layout", () => {
    localStorage.setItem(STORAGE_KEY, "2000");

    const { useSidebarWidth } = createSidebarWidthStore(LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useSidebarWidth());

    expect(result.current).toBe(LAYOUT.maxWidth);
  });

  test("a resize re-renders subscribers with the new width", () => {
    const { useSidebarWidth, setSidebarWidth } = createSidebarWidthStore(LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useSidebarWidth());

    act(() => setSidebarWidth(320));

    expect(result.current).toBe(320);
  });

  test("holds a resize within the layout", () => {
    const { useSidebarWidth, setSidebarWidth } = createSidebarWidthStore(LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useSidebarWidth());

    act(() => setSidebarWidth(0));

    expect(result.current).toBe(LAYOUT.minWidth);
  });
});

describe("commitSidebarWidth", () => {
  test("persists the current width under the storage key", () => {
    const { useSidebarWidth, setSidebarWidth, commitSidebarWidth } = createSidebarWidthStore(LAYOUT, STORAGE_KEY);
    renderHook(() => useSidebarWidth());

    act(() => setSidebarWidth(320));
    commitSidebarWidth();

    expect(localStorage.getItem(STORAGE_KEY)).toBe("320");
  });
});

describe("resetSidebarWidth", () => {
  test("returns to the default width and forgets the stored one", () => {
    localStorage.setItem(STORAGE_KEY, "320");

    const { useSidebarWidth, resetSidebarWidth } = createSidebarWidthStore(LAYOUT, STORAGE_KEY);
    const { result } = renderHook(() => useSidebarWidth());

    act(() => resetSidebarWidth());

    expect(result.current).toBe(LAYOUT.defaultWidth);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
