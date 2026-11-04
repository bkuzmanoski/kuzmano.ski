import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useViewportHeightAboveSoftwareKeyboard } from "./use-viewport-height-above-software-keyboard.ts";

let textInput: HTMLInputElement;

beforeEach(() => {
  textInput = document.createElement("input");
  document.body.append(textInput);
  textInput.focus();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  textInput.remove();
  document.documentElement.removeAttribute("style");
});

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

const viewportHeightAboveSoftwareKeyboard = () =>
  document.documentElement.style.getPropertyValue("--viewport-height-above-software-keyboard");

describe("useViewportHeightAboveSoftwareKeyboard", () => {
  test("sets the `--viewport-height-above-software-keyboard` custom property of `<html>` to the height of the visual viewport while the visual viewport is shorter than the layout viewport, and removes it when the visual viewport returns to the height of the layout viewport", () => {
    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("");

    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("500px");

    viewport.resizeTo(LAYOUT_HEIGHT_PX);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("");
  });

  test("sets the `--viewport-height-above-software-keyboard` custom property of `<html>` to the height of the visual viewport when a pan of the visual viewport shortens `innerHeight`", () => {
    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    vi.stubGlobal("innerHeight", LAYOUT_HEIGHT_PX - 200);
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("500px");
  });

  test("leaves the `--viewport-height-above-software-keyboard` custom property of `<html>` unset while the visual viewport is shorter than the layout viewport and the focused element is not editable", () => {
    const viewport = stubViewport();

    textInput.blur();
    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 114);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("");
  });

  test("removes the `--viewport-height-above-software-keyboard` custom property from `<html>` when the visual viewport grows to within the minimum software keyboard height of the layout viewport", () => {
    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("500px");

    viewport.resizeTo(LAYOUT_HEIGHT_PX - 1);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("");
  });

  test("removes the `--viewport-height-above-software-keyboard` custom property from `<html>` when the user zooms the page in", () => {
    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("500px");

    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300, 2);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("");
  });

  test("increases the `--viewport-height-above-software-keyboard` custom property of `<html>` only after the viewport height increase delay when the software keyboard shrinks while it stays shown", () => {
    vi.useFakeTimers();

    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 270);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("500px");

    vi.advanceTimersByTime(150);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("530px");
  });

  test("cancels a pending increase of the `--viewport-height-above-software-keyboard` custom property of `<html>` when the software keyboard grows back within the viewport height increase delay", () => {
    vi.useFakeTimers();

    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 270);
    vi.advanceTimersByTime(60);
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);
    vi.advanceTimersByTime(150);

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("500px");
  });

  test("does not set the `--viewport-height-above-software-keyboard` custom property of `<html>` again when the visual viewport scrolls without a change in height", () => {
    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);

    const setProperty = vi.spyOn(document.documentElement.style, "setProperty"); // A spy rather than a `MutationObserver` as jsdom does not record a mutation for a write of the same value.

    viewport.scroll();

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("500px");
    expect(setProperty).not.toHaveBeenCalled();
  });

  test("scrolls the window back to the top when the visual viewport scrolls while a text field has the focus", () => {
    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    vi.stubGlobal("scrollY", 120);
    viewport.scroll();

    expect(viewport.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test("scrolls the window back to the top when the visual viewport resizes as the software keyboard hides after a text field loses the focus", () => {
    const viewport = stubViewport();

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);
    textInput.blur();
    vi.stubGlobal("scrollY", 120);
    viewport.resizeTo(LAYOUT_HEIGHT_PX);

    expect(viewport.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test("leaves the scroll position of the window unchanged when the visual viewport scrolls while the focused element is not editable and the software keyboard is hidden", () => {
    const viewport = stubViewport();

    textInput.blur();
    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    vi.stubGlobal("scrollY", 120);
    viewport.scroll();

    expect(viewport.scrollTo).not.toHaveBeenCalled();
  });

  test("leaves the scroll position of the window unchanged when the visual viewport scrolls while the user has zoomed the page in", () => {
    const viewport = stubViewport({ scale: 2 });

    renderHook(() => useViewportHeightAboveSoftwareKeyboard());
    vi.stubGlobal("scrollY", 120);
    viewport.scroll();

    expect(viewport.scrollTo).not.toHaveBeenCalled();
  });

  test("removes the `--viewport-height-above-software-keyboard` custom property from `<html>` on unmount", () => {
    const viewport = stubViewport();
    const { unmount } = renderHook(() => useViewportHeightAboveSoftwareKeyboard());

    viewport.resizeTo(LAYOUT_HEIGHT_PX - 300);
    unmount();

    expect(viewportHeightAboveSoftwareKeyboard()).toBe("");
  });
});
