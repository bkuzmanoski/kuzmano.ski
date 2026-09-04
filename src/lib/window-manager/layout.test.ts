import { describe, expect, test } from "vitest";

import { createWindowPlacer } from "./layout.ts";
import { EMPTY_STATE } from "./window.ts";

import type { Size } from "../geometry.ts";
import type { WindowLayout, WindowSpec } from "./window.ts";

const DEFAULT_SIZE: Size = { width: 1024, height: 1024 };
const SPEC: WindowSpec = { defaultSize: DEFAULT_SIZE, openAt: "cascade", fixedSize: false };
const LAYOUT: WindowLayout = {
  windows: { entry: SPEC, collection: SPEC, contact: SPEC },
  minSize: { width: 480, height: 320 },
  cascadeOffset: { x: 16, y: 32 },
  padding: 8,
};

const SURFACE = { width: 1600, height: 1200 };

describe("createWindowPlacer", () => {
  const placeWindow = createWindowPlacer(LAYOUT);
  const windowRect = { x: 100, y: 50, width: 400, height: 300 };

  test("returns the window geometry unchanged when the desktop is unmeasured", () => {
    const placedRect = placeWindow(windowRect, EMPTY_STATE.surface);
    expect(placedRect).toEqual(windowRect);
  });

  test("returns the window geometry unchanged when it fits in the available space", () => {
    const placedRect = placeWindow(windowRect, SURFACE);
    expect(placedRect).toEqual(windowRect);
  });

  test("adjusts the position of a window that extends past the desktop bounds without changing its size", () => {
    const placedFromTopLeft = placeWindow({ ...windowRect, x: -50, y: -50 }, SURFACE);
    const placedFromBottomRight = placeWindow({ ...windowRect, x: 5000, y: 5000 }, SURFACE);

    expect(placedFromTopLeft).toEqual({
      x: LAYOUT.padding,
      y: LAYOUT.padding,
      width: windowRect.width,
      height: windowRect.height,
    });
    expect(placedFromBottomRight).toEqual({
      x: SURFACE.width - LAYOUT.padding - windowRect.width,
      y: SURFACE.height - LAYOUT.padding - windowRect.height,
      width: windowRect.width,
      height: windowRect.height,
    });
  });

  test("resizes a window that cannot fit within the desktop bounds", () => {
    const placedRect = placeWindow({ x: 900, y: 0, width: 400, height: 900 }, { width: 1000, height: 300 });
    expect(placedRect).toEqual({
      x: 1000 - LAYOUT.padding - 400,
      y: LAYOUT.padding,
      width: 400,
      height: 300 - 2 * LAYOUT.padding,
    });
  });

  test("resizes a window to zero dimensions on a desktop with no room to place it", () => {
    const placedRect = placeWindow(windowRect, { width: LAYOUT.padding, height: LAYOUT.padding });
    expect(placedRect).toEqual({ x: LAYOUT.padding, y: LAYOUT.padding, width: 0, height: 0 });
  });
});
