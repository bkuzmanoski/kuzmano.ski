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

test("the inset reports the height the keyboard covers", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());

  expect(inset()).toBe("0px");

  viewport.resizeTo(LAYOUT_HEIGHT - 300);

  expect(inset()).toBe("300px");

  viewport.resizeTo(LAYOUT_HEIGHT);

  expect(inset()).toBe("0px");
});

test("a gap too small to be a keyboard is ignored", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  viewport.resizeTo(LAYOUT_HEIGHT - 1);

  expect(inset()).toBe("0px");
});

test("a zoomed page reserves no space", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  viewport.resizeTo(LAYOUT_HEIGHT - 300, 2);

  expect(inset()).toBe("");
});

test("the pan the browser made to reveal the focused field is reset", () => {
  const viewport = stubViewport();

  renderHook(() => useKeyboardInset());
  vi.stubGlobal("scrollY", 120);
  viewport.scroll();

  expect(viewport.scrollTo).toHaveBeenCalledWith(0, 0);
});

test("unmounting stops reserving space", () => {
  const viewport = stubViewport();
  const { unmount } = renderHook(() => useKeyboardInset());

  viewport.resizeTo(LAYOUT_HEIGHT - 300);
  unmount();

  expect(inset()).toBe("");
});
