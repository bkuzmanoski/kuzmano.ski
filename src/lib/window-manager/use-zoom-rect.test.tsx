import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ZoomRectContext, useZoomRect } from "./use-zoom-rect.ts";

import type { WindowContent, WindowRecord } from "./window.ts";
import type { ReactNode } from "react";

const prefersReducedMotion = vi.hoisted(() => ({ matches: false }));
const openWindows = vi.hoisted((): { current: WindowRecord<WindowContent> } => ({ current: {} }));

vi.mock("./context.ts", async () =>
  (await import("#/test-utils/window-manager.ts")).windowManagerMock({ content: () => openWindows.current }),
);
vi.mock("../hooks/use-prefers-reduced-motion.ts", () => ({
  getPrefersReducedMotion: () => prefersReducedMotion.matches,
}));

const showZoomRect = vi.fn();

beforeEach(() => {
  prefersReducedMotion.matches = false;
  openWindows.current = {};
  showZoomRect.mockReset();
});

const ELEMENT_RECT = new DOMRect(10, 20, 30, 40);

function zoomFromElement() {
  const element = document.createElement("span");

  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(ELEMENT_RECT);

  const { result } = renderHook(() => useZoomRect(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ZoomRectContext value={showZoomRect}>{children}</ZoomRectContext>
    ),
  });

  result.current(element, "entry");
}

describe("useZoomRect", () => {
  test("grows the zoom rect from the element's viewport rect toward a window that is not open", () => {
    zoomFromElement();
    expect(showZoomRect).toHaveBeenCalledExactlyOnceWith({ windowId: "entry", from: ELEMENT_RECT });
  });

  test("does not show a zoom rect toward a window that is already open", () => {
    openWindows.current = { entry: { route: "/collection/entry", title: "Entry" } };
    zoomFromElement();

    expect(showZoomRect).not.toHaveBeenCalled();
  });

  test("does not show a zoom rect when the user prefers reduced motion", () => {
    prefersReducedMotion.matches = true;
    zoomFromElement();

    expect(showZoomRect).not.toHaveBeenCalled();
  });
});
