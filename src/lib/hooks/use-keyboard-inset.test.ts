import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { useKeyboardInset } from "./use-keyboard-inset.ts";

const LAYOUT_HEIGHT_PX = 800;

function stubViewport({ height = LAYOUT_HEIGHT_PX, scale = 1 } = {}) {
  const listeners = new Map<string, () => void>();
  const viewport = {
    height,
    scale,
    addEventListener: (type: string, listener: () => void, { signal }: { signal: AbortSignal }) => {
      listeners.set(type, listener);
      signal.addEventListener("abort", () => listeners.delete(type));
    },
    removeEventListener: vi.fn(),
  };

  const scrollTo = vi.fn();

  vi.stubGlobal("innerHeight", LAYOUT_HEIGHT_PX);
  vi.stubGlobal("scrollTo", scrollTo);
  vi.stubGlobal("visualViewport", viewport);

  return {
    scrollTo,
    resizeTo(nextHeight: number, nextScale = viewport.scale) {
      viewport.height = nextHeight;
      viewport.scale = nextScale;
      act(() => listeners.get("resize")?.());
    },
    scroll: () => act(() => listeners.get("scroll")?.()),
  };
}

const inset = () => document.documentElement.style.getPropertyValue("--keyboard-inset");

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
});

test("`--keyboard-inset` is set to the gap between the layout and visual viewport heights, and removed when the gap closes", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());

  expect(inset()).toBe("");

  viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

  expect(inset()).toBe("300px");

  viewport.resizeTo(LAYOUT_HEIGHT_PX);

  expect(inset()).toBe("");
});

test("`--keyboard-inset` is removed when the gap is below the keyboard threshold", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

  expect(inset()).toBe("300px");

  viewport.resizeTo(LAYOUT_HEIGHT_PX - 1);

  expect(inset()).toBe("");
});

test("`--keyboard-inset` is removed while the page is zoomed in", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

  expect(inset()).toBe("300px");

  viewport.resizeTo(LAYOUT_HEIGHT_PX - 300, 2);

  expect(inset()).toBe("");
});

test("a scroll of the visual viewport that leaves the gap unchanged does not write `--keyboard-inset`", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

  // A spy rather than a `MutationObserver`, since jsdom does not record a mutation for a write of the same value.
  const setProperty = vi.spyOn(document.documentElement.style, "setProperty");

  viewport.scroll();

  expect(inset()).toBe("300px");
  expect(setProperty).not.toHaveBeenCalled();
});

test("the window is scrolled back to the top when the visual viewport scrolls", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  vi.stubGlobal("scrollY", 120);
  viewport.scroll();

  expect(viewport.scrollTo).toHaveBeenCalledWith(0, 0);
});

test("unmounting removes `--keyboard-inset`", () => {
  const viewport = stubViewport();
  const { unmount } = renderHook(() => useKeyboardInset());

  viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);
  unmount();

  expect(inset()).toBe("");
});
