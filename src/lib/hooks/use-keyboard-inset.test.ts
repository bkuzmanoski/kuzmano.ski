import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { useKeyboardInset } from "./use-keyboard-inset.ts";

const LAYOUT_HEIGHT = 800;

function stubViewport({ height = LAYOUT_HEIGHT, scale = 1 } = {}) {
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

  vi.stubGlobal("innerHeight", LAYOUT_HEIGHT);
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

test("`--keyboard-inset` is set to the gap between the layout and visual viewport heights", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());

  expect(inset()).toBe("0px");

  viewport.resizeTo(LAYOUT_HEIGHT - 300);

  expect(inset()).toBe("300px");

  viewport.resizeTo(LAYOUT_HEIGHT);

  expect(inset()).toBe("0px");
});

test("`--keyboard-inset` is set to `0px` when the gap is below the keyboard threshold", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  viewport.resizeTo(LAYOUT_HEIGHT - 1);

  expect(inset()).toBe("0px");
});

test("`--keyboard-inset` is removed while the page is zoomed in", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  viewport.resizeTo(LAYOUT_HEIGHT - 300, 2);

  expect(inset()).toBe("");
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

  viewport.resizeTo(LAYOUT_HEIGHT - 300);
  unmount();

  expect(inset()).toBe("");
});
