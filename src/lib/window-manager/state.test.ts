import { describe, expect, test } from "vitest";

import { createWindowPlacer, createWindowResizer } from "./layout.ts";
import { createWindowReducer } from "./state.ts";
import { EMPTY_STATE, WINDOW_DOM_ORDER } from "./window.ts";

import type { Size } from "../geometry.ts";
import type { Action, ManagerState, WindowId, WindowLayout, WindowSpec } from "./window.ts";

const SURFACE = { width: 1600, height: 1200 };
const DEFAULT_SIZE: Size = { width: 1024, height: 1024 };
const SPEC: WindowSpec = { defaultSize: DEFAULT_SIZE, fixedSize: false };
const WINDOW_LAYOUT: WindowLayout = {
  windows: { entry: SPEC, collection: SPEC, contact: SPEC },
  minSize: { width: 480, height: 320 },
  padding: 8,
};

const centerOf = (size: Size) => ({ x: (SURFACE.width - size.width) / 2, y: (SURFACE.height - size.height) / 2 });

const CENTER_POSITION = centerOf(DEFAULT_SIZE);

const reducer = createWindowReducer(WINDOW_LAYOUT);

const openAction = (id: WindowId, route: string): Action => ({ type: "open", id, route, title: route });

function openedOn(surface: Size, ...ids: Array<WindowId>): ManagerState {
  return ids.reduce(
    (state, id) => reducer(state, openAction(id, `/${id}`)),
    reducer(EMPTY_STATE, { type: "measure", surface }),
  );
}

function opened(...ids: Array<WindowId>): ManagerState {
  return openedOn(SURFACE, ...ids);
}

describe("open", () => {
  test("opens the window, raises it to the front, and focuses it", () => {
    const state = opened("entry");

    expect(state.order).toEqual(["entry"]);
    expect(state.focused).toBe("entry");
    expect(state.content.entry).toEqual({ route: "/entry", title: "/entry" });
  });

  test("opens the window centered on the desktop", () => {
    const state = opened("entry", "collection");

    expect(state.geometry.entry).toMatchObject({ ...CENTER_POSITION, ...DEFAULT_SIZE });
    expect(state.geometry.collection).toMatchObject({ ...CENTER_POSITION, ...DEFAULT_SIZE });
  });

  test("resizes a window down to fit the available space", () => {
    const state = openedOn({ width: 600, height: 400 }, "entry");

    expect(state.geometry.entry).toMatchObject({
      x: WINDOW_LAYOUT.padding,
      y: WINDOW_LAYOUT.padding,
      width: 600 - 2 * WINDOW_LAYOUT.padding,
      height: 400 - 2 * WINDOW_LAYOUT.padding,
    });
  });

  test("opens a window below its minimum size rather than past the edge of a desktop smaller than that size", () => {
    const state = openedOn({ width: SURFACE.width, height: 200 }, "entry");
    const height = 200 - 2 * WINDOW_LAYOUT.padding;

    expect(height).toBeLessThan(WINDOW_LAYOUT.minSize.height);
    expect(state.geometry.entry).toMatchObject({ y: WINDOW_LAYOUT.padding, height });
  });

  test("opens every window at a position and size that fits within the desktop", () => {
    const state = opened(...WINDOW_DOM_ORDER);
    const placeWindow = createWindowPlacer(WINDOW_LAYOUT);

    for (const id of WINDOW_DOM_ORDER) {
      const { maximized: _maximized, ...geometry } = state.geometry[id]!;
      const placedRect = placeWindow(geometry, SURFACE);
      expect(placedRect).toEqual(geometry);
    }
  });

  test("replaces the content of a window already showing a different route, raises and focuses it, and preserves its geometry", () => {
    const initialState = opened("collection", "entry");
    const mutatedState = reducer(initialState, openAction("collection", "/collection/entry"));

    expect(mutatedState.order).toEqual(["entry", "collection"]);
    expect(mutatedState.focused).toBe("collection");
    expect(mutatedState.content.collection).toEqual({ route: "/collection/entry", title: "/collection/entry" });
    expect(mutatedState.geometry.collection).toEqual(initialState.geometry.collection);
  });

  test("only raises a window already showing the same route", () => {
    const initialState = opened("collection", "entry");
    const mutatedState = reducer(initialState, openAction("collection", "/collection"));

    expect(mutatedState.order).toEqual(["entry", "collection"]);
    expect(mutatedState.content).toBe(initialState.content);
  });
});

describe("close", () => {
  test("removes the window and focuses the next window in the stack", () => {
    const state = reducer(opened("collection", "entry"), { type: "close", id: "entry" });

    expect(state.order).toEqual(["collection"]);
    expect(state.focused).toBe("collection");
    expect(state.content.entry).toBeUndefined();
    expect(state.geometry.entry).toBeUndefined();
  });

  test("focuses the desktop when applied to the last open window", () => {
    expect(reducer(opened("entry"), { type: "close", id: "entry" }).focused).toBeNull();
  });

  test("retains the existing focus when applied to an inactive window", () => {
    const state = reducer(opened("collection", "entry"), { type: "close", id: "collection" });
    expect(state.focused).toBe("entry");
  });

  test("returns the same state for a closed window", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "close", id: "contact" })).toBe(state);
  });
});

describe("focus", () => {
  test("raises the window to the front of the stack", () => {
    const state = reducer(opened("collection", "entry"), { type: "focus", id: "collection" });

    expect(state.order).toEqual(["entry", "collection"]);
    expect(state.focused).toBe("collection");
  });

  test("returns the same state for the focused window", () => {
    const state = opened("collection", "entry");
    expect(reducer(state, { type: "focus", id: "entry" })).toBe(state);
  });

  test("returns the same state for a closed window", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "focus", id: "contact" })).toBe(state);
  });
});

describe("move", () => {
  test("sets the position and keeps the size unchanged", () => {
    const state = reducer(opened("entry"), { type: "move", id: "entry", x: 50, y: 50 });
    expect(state.geometry.entry).toMatchObject({ x: 50, y: 50, ...DEFAULT_SIZE });
  });

  test("clamps the position to the edges of the desktop", () => {
    const state = reducer(opened("entry"), { type: "move", id: "entry", x: 5000, y: 5000 });

    expect(state.geometry.entry).toMatchObject({
      x: SURFACE.width - WINDOW_LAYOUT.padding - DEFAULT_SIZE.width,
      y: SURFACE.height - WINDOW_LAYOUT.padding - DEFAULT_SIZE.height,
      ...DEFAULT_SIZE,
    });
  });

  test("returns the same state for a closed window", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "move", id: "contact", x: 1, y: 2 })).toBe(state);
  });
});

describe("resize", () => {
  test("sets the size", () => {
    const state = reducer(opened("entry"), { type: "resize", id: "entry", width: 640, height: 480 });
    expect(state.geometry.entry).toMatchObject({ width: 640, height: 480 });
  });

  test("clamps the size to the minimum size", () => {
    const state = reducer(opened("entry"), { type: "resize", id: "entry", width: 10, height: 10 });
    expect(state.geometry.entry).toMatchObject(WINDOW_LAYOUT.minSize);
  });

  test("clamps the size to the edges of the desktop", () => {
    const state = reducer(opened("entry"), { type: "resize", id: "entry", width: 5000, height: 5000 });
    expect(state.geometry.entry).toMatchObject({
      x: WINDOW_LAYOUT.padding,
      y: WINDOW_LAYOUT.padding,
      width: SURFACE.width - 2 * WINDOW_LAYOUT.padding,
      height: SURFACE.height - 2 * WINDOW_LAYOUT.padding,
    });
  });

  test("resizes a window wider than the desktop from the position it is rendered at", () => {
    const narrowSurface = { width: 600, height: 800 };
    const initialState = reducer(opened("entry"), { type: "measure", surface: narrowSurface });
    const mutatedState = reducer(initialState, { type: "resize", id: "entry", width: 560, height: 400 });

    expect(initialState.geometry.entry).toMatchObject({ x: CENTER_POSITION.x, width: DEFAULT_SIZE.width });
    expect(mutatedState.geometry.entry).toMatchObject({ x: WINDOW_LAYOUT.padding, width: 560 });
  });
});

describe("zoom", () => {
  test("toggles `maximized`, raises the window, and focuses it", () => {
    const state = reducer(opened("entry", "collection"), { type: "zoom", id: "entry" });

    expect(state.geometry.entry!.maximized).toBe(true);
    expect(state.order).toEqual(["collection", "entry"]);
    expect(state.focused).toBe("entry");
    expect(reducer(state, { type: "zoom", id: "entry" }).geometry.entry!.maximized).toBe(false);
  });

  test("returns the same state for a closed window", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "zoom", id: "contact" })).toBe(state);
  });
});

describe("measure", () => {
  test("the first measurement centers a pre-rendered window at its default size", () => {
    const preRendered = reducer(EMPTY_STATE, openAction("entry", "/entry"));
    const measuredState = reducer(preRendered, { type: "measure", surface: SURFACE });

    expect(preRendered.geometry.entry).toMatchObject({ x: 0, y: 0, ...DEFAULT_SIZE });
    expect(measuredState.geometry.entry).toMatchObject({ ...CENTER_POSITION, ...DEFAULT_SIZE });
  });

  test("the first measurement fits a pre-rendered window into the padded area", () => {
    const preRendered = reducer(EMPTY_STATE, openAction("entry", "/entry"));
    const measuredState = reducer(preRendered, { type: "measure", surface: { width: 600, height: 400 } });

    expect(measuredState.geometry.entry).toMatchObject({
      x: WINDOW_LAYOUT.padding,
      y: WINDOW_LAYOUT.padding,
      width: 600 - 2 * WINDOW_LAYOUT.padding,
      height: 400 - 2 * WINDOW_LAYOUT.padding,
    }); // What CSS rendered before the desktop was measured (see `.unplaced` in `/src/features/windows/window.module.css`).
  });

  test("a subsequent measurement updates the surface without changing the window geometry", () => {
    const movedState = reducer(opened("entry"), { type: "move", id: "entry", x: 10, y: 10 });
    const measuredState = reducer(movedState, { type: "measure", surface: { width: 640, height: 480 } });

    expect(measuredState.geometry).toBe(movedState.geometry);
    expect(measuredState.surface).toEqual({ width: 640, height: 480 });
  });

  test("a measurement of an unchanged size returns the same state", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "measure", surface: SURFACE })).toBe(state);
  });
});

describe("cycleWindows", () => {
  const cycled = (state: ManagerState) => reducer(state, { type: "cycleWindows" });

  test("moves the focus down through the stack and back to the window it started on", () => {
    const initialState = opened("collection", "entry", "contact");
    const secondWindow = cycled(initialState);
    const thirdWindow = cycled(secondWindow);
    const backToTheStart = cycled(thirdWindow);

    expect(secondWindow.focused).toBe("collection");
    expect(secondWindow.order).toEqual(["entry", "contact", "collection"]);
    expect(thirdWindow.focused).toBe("entry");
    expect(backToTheStart.focused).toBe("contact");
    expect(backToTheStart.order).toEqual(initialState.order);
  });

  test("focuses the window on top when the desktop is focused", () => {
    const state = cycled(reducer(opened("collection", "entry"), { type: "focusDesktop" }));

    expect(state.focused).toBe("entry");
    expect(state.order).toEqual(["collection", "entry"]);
  });

  test("does not change the geometry of any window", () => {
    const initialState = opened("collection", "entry");
    expect(cycled(initialState).geometry).toBe(initialState.geometry);
  });

  test("returns the same state when at most one window is open", () => {
    const state = opened("entry");

    expect(cycled(state)).toBe(state);
    expect(cycled(EMPTY_STATE)).toBe(EMPTY_STATE);
  });
});

describe("focusDesktop", () => {
  test("focuses the desktop without changing the window order or geometry", () => {
    const initialState = opened("collection", "entry");
    const mutatedState = reducer(initialState, { type: "focusDesktop" });

    expect(mutatedState.focused).toBeNull();
    expect(mutatedState.order).toEqual(["collection", "entry"]);
    expect(mutatedState.geometry).toBe(initialState.geometry);
  });

  test("returns the same state when the desktop is already focused", () => {
    const state = reducer(opened("entry"), { type: "focusDesktop" });
    expect(reducer(state, { type: "focusDesktop" })).toBe(state);
  });
});

describe("per-window layout", () => {
  const SMALL_SIZE: Size = { width: 480, height: 420 };

  const varyingReducer = createWindowReducer({
    ...WINDOW_LAYOUT,
    windows: { ...WINDOW_LAYOUT.windows, contact: { ...SPEC, defaultSize: SMALL_SIZE } },
  });

  test("each window opens at its default size, centered on the desktop surface", () => {
    const measuredState = varyingReducer(EMPTY_STATE, { type: "measure", surface: SURFACE });
    const withEntry = varyingReducer(measuredState, openAction("entry", "/entry"));
    const state = varyingReducer(withEntry, openAction("contact", "/contact"));

    expect(state.geometry.entry).toMatchObject({ ...centerOf(DEFAULT_SIZE), ...DEFAULT_SIZE });
    expect(state.geometry.contact).toMatchObject({ ...centerOf(SMALL_SIZE), ...SMALL_SIZE });
  });
});

describe("createWindowResizer", () => {
  const resizeWindow = createWindowResizer(WINDOW_LAYOUT);

  test.each([
    ["a size that fits", { width: 640, height: 480 }],
    ["a size below the minimum", { width: 10, height: 10 }],
    ["a size larger than the desktop", { width: 5000, height: 5000 }],
  ])("returns the same rect as the reducer's resize action for %s", (_, size) => {
    const state = opened("entry");
    const resizedState = reducer(state, { type: "resize", id: "entry", ...size });

    expect(resizeWindow(state.geometry.entry!, SURFACE, size)).toEqual({
      x: resizedState.geometry.entry!.x,
      y: resizedState.geometry.entry!.y,
      width: resizedState.geometry.entry!.width,
      height: resizedState.geometry.entry!.height,
    });
  });
});

describe("the not-found alert", () => {
  const showNotFoundAlert = (state: ManagerState, route: string) =>
    reducer(state, { type: "showNotFoundAlert", route });

  test("records the route without changing the open windows or focus", () => {
    const initialState = opened("collection", "entry");
    const state = showNotFoundAlert(initialState, "/nonexistent-page");

    expect(state.notFoundRoute).toBe("/nonexistent-page");
    expect(state.focused).toBe("entry");
    expect(state.content).toBe(initialState.content);
    expect(state.order).toBe(initialState.order);
  });

  test("returns the same state for the route already recorded, and records a different route", () => {
    const state = showNotFoundAlert(opened("entry"), "/nonexistent-page");

    expect(showNotFoundAlert(state, "/nonexistent-page")).toBe(state);
    expect(showNotFoundAlert(state, "/other-nonexistent-page").notFoundRoute).toBe("/other-nonexistent-page");
  });

  test("clears the route when dismissed", () => {
    const state = showNotFoundAlert(opened("entry"), "/nonexistent-page");
    expect(reducer(state, { type: "dismissNotFoundAlert" }).notFoundRoute).toBeNull();
  });

  test("preserves the focused window when dismissed", () => {
    const state = showNotFoundAlert(opened("entry"), "/nonexistent-page");
    expect(reducer(state, { type: "dismissNotFoundAlert" }).focused).toBe("entry");
  });

  test("returns the same state when dismissed without a recorded route", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "dismissNotFoundAlert" })).toBe(state);
  });

  test("clears the route when a window is opened or the desktop is focused", () => {
    const state = showNotFoundAlert(opened("entry"), "/nonexistent-page");

    expect(reducer(state, openAction("collection", "/collection")).notFoundRoute).toBeNull();
    expect(reducer(state, openAction("entry", "/entry")).notFoundRoute).toBeNull();
    expect(reducer(state, { type: "focusDesktop" }).notFoundRoute).toBeNull();
  });
});
