import { beforeEach, describe, expect, test } from "vitest";

import {
  EMPTY_STATE,
  WINDOW_DOM_ORDER,
  createCloseGuards,
  createWindowPlacer,
  createWindowReducer,
  createWindowResizer,
} from "./window-manager";

import type { Size } from "./geometry";
import type { Action, CloseGuards, ManagerState, WindowId, WindowLayout, WindowSpec } from "./window-manager";

// Every window is given the same size and opens the same way, so the suite below reads as
// one cascade. The layouts that vary by window are covered in `per-window layout`.

const DEFAULT_SIZE: Size = { width: 1024, height: 1024 };
const SPEC: WindowSpec = { defaultSize: DEFAULT_SIZE, openAt: "cascade", fixedSize: false };
const LAYOUT: WindowLayout = {
  windows: { entry: SPEC, collection: SPEC, contact: SPEC },
  minSize: { width: 480, height: 320 },
  cascadeOffset: { x: 16, y: 32 },
  padding: 8,
};

const SURFACE = { width: 1600, height: 1200 }; // Room for the default size plus a cascade step on every edge.
const CENTER_POSITION = {
  x: (SURFACE.width - DEFAULT_SIZE.width) / 2,
  y: (SURFACE.height - DEFAULT_SIZE.height) / 2,
};

const reducer = createWindowReducer(LAYOUT);

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

  test("the first window is centered on the desktop and subsequent windows cascade from there", () => {
    const state = opened("entry", "collection");

    expect(state.geometry.entry).toMatchObject({ ...CENTER_POSITION, ...DEFAULT_SIZE });
    expect(state.geometry.collection).toMatchObject({
      x: CENTER_POSITION.x + LAYOUT.cascadeOffset.x,
      y: CENTER_POSITION.y + LAYOUT.cascadeOffset.y,
      ...DEFAULT_SIZE, // A desktop with room to spare places both windows at the default size.
    });
  });

  test("resizes a window down to fit the available space", () => {
    const state = openedOn({ width: 600, height: 400 }, "entry");

    expect(state.geometry.entry).toMatchObject({
      x: LAYOUT.padding,
      y: LAYOUT.padding,
      width: 600 - 2 * LAYOUT.padding,
      height: 400 - 2 * LAYOUT.padding,
    });
  });

  test("resizes a cascaded window to fit the available space", () => {
    const surface = { width: 1060, height: 1080 };
    const center = {
      x: (surface.width - DEFAULT_SIZE.width) / 2,
      y: (surface.height - DEFAULT_SIZE.height) / 2,
    };
    const cascaded = {
      x: center.x + LAYOUT.cascadeOffset.x,
      y: center.y + LAYOUT.cascadeOffset.y,
    };
    const state = openedOn(surface, "entry", "collection");

    expect(state.geometry.entry).toMatchObject({ ...center, ...DEFAULT_SIZE });
    expect(state.geometry.collection).toMatchObject({
      ...cascaded,
      width: surface.width - LAYOUT.padding - cascaded.x,
      height: surface.height - LAYOUT.padding - cascaded.y,
    });
  });

  test("drops the cascade step on an axis where it would take the window below its minimum size", () => {
    const surface = { width: SURFACE.width, height: 340 }; // Room for a horizontal step, but not a vertical one.
    const state = openedOn(surface, "entry", "collection");
    const height = surface.height - 2 * LAYOUT.padding; // Short of the default size, but above the minimum.

    expect(height).toBeGreaterThanOrEqual(LAYOUT.minSize.height);
    expect(state.geometry.entry).toMatchObject({ x: CENTER_POSITION.x, y: LAYOUT.padding, height });
    expect(state.geometry.collection).toMatchObject({
      x: CENTER_POSITION.x + LAYOUT.cascadeOffset.x,
      y: LAYOUT.padding,
      height,
    });
  });

  test("drops the cascade step when the available space is less than the minimum size", () => {
    const state = openedOn({ width: SURFACE.width, height: 200 }, "entry");
    const height = 200 - 2 * LAYOUT.padding;

    expect(height).toBeLessThan(LAYOUT.minSize.height);
    expect(state.geometry.entry).toMatchObject({ y: LAYOUT.padding, height });
  });

  test("opens every window at a position and size that fits within the desktop", () => {
    const state = opened(...WINDOW_DOM_ORDER);
    const placeWindow = createWindowPlacer(LAYOUT);

    for (const id of WINDOW_DOM_ORDER) {
      const { maximized: _maximized, ...geometry } = state.geometry[id]!;
      const placedRect = placeWindow(geometry, SURFACE);
      expect(placedRect).toEqual(geometry); // Cascade slots are placed already so an opened window does not move.
    }
  });

  test("a route that resolves to an existing window replaces what it shows in place", () => {
    const initialState = opened("collection", "entry");
    const mutatedState = reducer(initialState, openAction("collection", "/tech-notes/entry"));

    expect(mutatedState.order).toEqual(["entry", "collection"]);
    expect(mutatedState.focused).toBe("collection");
    expect(mutatedState.content.collection).toEqual({ route: "/tech-notes/entry", title: "/tech-notes/entry" });
    expect(mutatedState.geometry.collection).toEqual(initialState.geometry.collection);
  });

  test("re-opening the route a window already shows only raises it", () => {
    const initialState = opened("collection", "entry");
    const mutatedState = reducer(initialState, openAction("collection", "/collection"));

    expect(mutatedState.order).toEqual(["entry", "collection"]);
    expect(mutatedState.content).toBe(initialState.content);
  });
});

describe("close", () => {
  test("hands the focus to the next window in the stack", () => {
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

  test("is a no-op on a closed window", () => {
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

  test("does not affect state when applied to a focused window", () => {
    const state = opened("collection", "entry");
    expect(reducer(state, { type: "focus", id: "entry" })).toBe(state);
  });

  test("is a no-op on a closed window", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "focus", id: "contact" })).toBe(state);
  });
});

describe("move", () => {
  test("sets the position and leaves the size unchanged", () => {
    const state = reducer(opened("entry"), { type: "move", id: "entry", x: 50, y: 50 });
    expect(state.geometry.entry).toMatchObject({ x: 50, y: 50, ...DEFAULT_SIZE });
  });

  test("stops at the edge of the desktop rather than banking movement past it", () => {
    const state = reducer(opened("entry"), { type: "move", id: "entry", x: 5000, y: 5000 });

    expect(state.geometry.entry).toMatchObject({
      x: SURFACE.width - LAYOUT.padding - DEFAULT_SIZE.width,
      y: SURFACE.height - LAYOUT.padding - DEFAULT_SIZE.height,
      ...DEFAULT_SIZE,
    });
  });

  test("a closed window is a no-op", () => {
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
    expect(state.geometry.entry).toMatchObject(LAYOUT.minSize);
  });

  test("stops at the edge of the desktop rather than banking size past it", () => {
    const state = reducer(opened("entry"), { type: "resize", id: "entry", width: 5000, height: 5000 });
    expect(state.geometry.entry).toMatchObject({
      x: LAYOUT.padding,
      y: LAYOUT.padding,
      width: SURFACE.width - 2 * LAYOUT.padding,
      height: SURFACE.height - 2 * LAYOUT.padding,
    });
  });

  test("a window wider than the desktop takes the position it is rendered at", () => {
    const narrowSurface = { width: 600, height: 800 };
    const initialState = reducer(opened("entry"), { type: "measure", surface: narrowSurface });
    const mutatedState = reducer(initialState, { type: "resize", id: "entry", width: 560, height: 400 });

    expect(initialState.geometry.entry).toMatchObject({ x: CENTER_POSITION.x, width: DEFAULT_SIZE.width });
    expect(mutatedState.geometry.entry).toMatchObject({ x: LAYOUT.padding, width: 560 });
  });
});

describe("zoom", () => {
  test("toggles maximized and raises the window", () => {
    const state = reducer(opened("entry", "collection"), { type: "zoom", id: "entry" });

    expect(state.geometry.entry!.maximized).toBe(true);
    expect(state.order).toEqual(["collection", "entry"]);
    expect(state.focused).toBe("entry");
    expect(reducer(state, { type: "zoom", id: "entry" }).geometry.entry!.maximized).toBe(false);
  });

  test("is a no-op on a closed window", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "zoom", id: "contact" })).toBe(state);
  });
});

describe("measure", () => {
  test("the first measurement matches the pre-rendered geometry", () => {
    const preRendered = reducer(EMPTY_STATE, openAction("entry", "/entry"));
    const measured = reducer(preRendered, { type: "measure", surface: SURFACE });

    expect(preRendered.geometry.entry).toMatchObject({ x: 0, y: 0, ...DEFAULT_SIZE });
    expect(measured.geometry.entry).toMatchObject({ ...CENTER_POSITION, ...DEFAULT_SIZE });
  });

  test("the first measurement fits a pre-rendered window into the padded area", () => {
    const preRendered = reducer(EMPTY_STATE, openAction("entry", "/entry"));
    const measured = reducer(preRendered, { type: "measure", surface: { width: 600, height: 400 } });

    // What CSS rendered before the desktop was measured (see `.unplaced` in `window.module.css`).
    expect(measured.geometry.entry).toMatchObject({
      x: LAYOUT.padding,
      y: LAYOUT.padding,
      width: 600 - 2 * LAYOUT.padding,
      height: 400 - 2 * LAYOUT.padding,
    });
  });

  test("a subsequent measurement leaves the windows where they are", () => {
    const movedState = reducer(opened("entry"), { type: "move", id: "entry", x: 10, y: 10 });
    const measured = reducer(movedState, { type: "measure", surface: { width: 640, height: 480 } });

    expect(measured.geometry).toBe(movedState.geometry);
    expect(measured.surface).toEqual({ width: 640, height: 480 });
  });

  test("is a no-op when the size is unchanged", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "measure", surface: SURFACE })).toBe(state);
  });
});

describe("organize", () => {
  test("un-maximizes and re-cascades every window in stack order", () => {
    const zoomedState = reducer(opened("collection", "entry"), { type: "zoom", id: "collection" });
    const movedState = reducer(zoomedState, { type: "move", id: "collection", x: 999, y: 999 });
    const organizedState = reducer(movedState, { type: "organize" });

    // Zooming raised the collection window, so the cascade now runs the entry window, then it.
    expect(organizedState.order).toEqual(["entry", "collection"]);
    expect(organizedState.geometry.collection!.maximized).toBe(false);
    expect(organizedState.geometry.entry).toMatchObject(CENTER_POSITION);
    expect(organizedState.geometry.collection).toMatchObject({
      x: CENTER_POSITION.x + LAYOUT.cascadeOffset.x,
      y: CENTER_POSITION.y + LAYOUT.cascadeOffset.y,
    });
  });

  test("resizes a window down to its cascade slot if it does not fit", () => {
    const enlargedState = reducer(opened("entry", "collection"), {
      type: "resize",
      id: "entry",
      width: 1200,
      height: 700,
    });
    const resizedState = reducer(enlargedState, { type: "resize", id: "collection", width: 500, height: 400 });
    const organizedState = reducer(resizedState, { type: "organize" });

    // The entry window loses the width its slot cannot hold and keeps the height that fits.
    expect(organizedState.geometry.entry).toMatchObject({
      ...CENTER_POSITION,
      width: DEFAULT_SIZE.width,
      height: 700,
    });
    expect(organizedState.geometry.collection).toMatchObject({
      x: CENTER_POSITION.x + LAYOUT.cascadeOffset.x,
      y: CENTER_POSITION.y + LAYOUT.cascadeOffset.y,
      width: 500,
      height: 400,
    });
  });

  test("keeps the focus where it was", () => {
    expect(reducer(opened("collection", "entry"), { type: "organize" }).focused).toBe("entry");
    expect(reducer(reducer(opened("entry"), { type: "focusDesktop" }), { type: "organize" }).focused).toBeNull();
  });
});

describe("cycleWindows", () => {
  const cycled = (state: ManagerState) => reducer(state, { type: "cycleWindows" });

  test("walks the focus down through the stack and back around to where it started", () => {
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

  test("activates the window on top when the desktop is active", () => {
    const state = cycled(reducer(opened("collection", "entry"), { type: "focusDesktop" }));

    expect(state.focused).toBe("entry");
    expect(state.order).toEqual(["collection", "entry"]);
  });

  test("does not change the geometry of any window", () => {
    const initialState = opened("collection", "entry");
    expect(cycled(initialState).geometry).toBe(initialState.geometry);
  });

  test("is a no-op with one window open, and with none", () => {
    const state = opened("entry");

    expect(cycled(state)).toBe(state);
    expect(cycled(EMPTY_STATE)).toBe(EMPTY_STATE);
  });
});

describe("focusDesktop", () => {
  test("keeps the windows open and makes the desktop active", () => {
    const initialState = opened("collection", "entry");
    const mutatedState = reducer(initialState, { type: "focusDesktop" });

    expect(mutatedState.focused).toBeNull();
    expect(mutatedState.order).toEqual(["collection", "entry"]);
    expect(mutatedState.geometry).toBe(initialState.geometry);
  });

  test("is a no-op when the desktop is already active", () => {
    const state = reducer(opened("entry"), { type: "focusDesktop" });
    expect(reducer(state, { type: "focusDesktop" })).toBe(state);
  });
});

describe("per-window layout", () => {
  const SMALL_SIZE: Size = { width: 480, height: 420 };

  const centerOf = (size: Size) => ({
    x: (SURFACE.width - size.width) / 2,
    y: (SURFACE.height - size.height) / 2,
  });

  const varyingReducer = createWindowReducer({
    ...LAYOUT,
    windows: { ...LAYOUT.windows, contact: { ...SPEC, defaultSize: SMALL_SIZE, openAt: "center" } },
  });

  const openedOnDesktop = (...ids: Array<WindowId>) =>
    ids.reduce(
      (state, id) => varyingReducer(state, openAction(id, `/${id}`)),
      varyingReducer(EMPTY_STATE, { type: "measure", surface: SURFACE }),
    );

  test("a window opens at the specified default size", () => {
    expect(openedOnDesktop("entry").geometry.entry).toMatchObject(DEFAULT_SIZE);
    expect(openedOnDesktop("contact").geometry.contact).toMatchObject(SMALL_SIZE);
  });

  test("a window that opens in the center is not affected by the cascade", () => {
    const state = openedOnDesktop("entry", "collection", "contact");

    expect(state.geometry.collection).toMatchObject({ x: CENTER_POSITION.x + LAYOUT.cascadeOffset.x }); // The cascade is unaffected.
    expect(state.geometry.contact).toMatchObject(centerOf(SMALL_SIZE));
  });

  test("organizing cascades every open window, including those that open in the center", () => {
    const state = varyingReducer(openedOnDesktop("entry", "contact"), { type: "organize" });
    expect(state.geometry.contact).toMatchObject({
      x: centerOf(SMALL_SIZE).x + LAYOUT.cascadeOffset.x,
      y: centerOf(SMALL_SIZE).y + LAYOUT.cascadeOffset.y,
    });
  });
});

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

describe("createWindowResizer", () => {
  const resizeWindow = createWindowResizer(LAYOUT);

  test.each([
    ["a size that fits", { width: 640, height: 480 }],
    ["a size below the minimum", { width: 10, height: 10 }],
    ["a size larger than the desktop", { width: 5000, height: 5000 }],
  ])("lands a window on the rect the reducer gives it for %s", (_, size) => {
    const state = opened("entry");
    const resized = reducer(state, { type: "resize", id: "entry", ...size });

    expect(resizeWindow(state.geometry.entry!, SURFACE, size)).toEqual({
      x: resized.geometry.entry!.x,
      y: resized.geometry.entry!.y,
      width: resized.geometry.entry!.width,
      height: resized.geometry.entry!.height,
    });
  });
});

describe("close guards", () => {
  let guards: CloseGuards;

  beforeEach(() => {
    guards = createCloseGuards();
  });

  test("a window without a guard leaves the close request unclaimed", () => {
    expect(guards.claim("entry")).toBe(false);
  });

  test("a guard only claims close requests for its own window", () => {
    const unregister = guards.register("contact", () => true);

    expect(guards.claim("contact")).toBe(true);
    expect(guards.claim("entry")).toBe(false);

    unregister();

    expect(guards.claim("contact")).toBe(false);
  });

  test("a guard that declines a request leaves the window closable", () => {
    guards.register("contact", () => false);
    expect(guards.claim("contact")).toBe(false);
  });

  test("unregistering a replaced guard leaves the replacement registered", () => {
    const unregisterFirst = guards.register("contact", () => false);

    guards.register("contact", () => true);
    unregisterFirst();

    expect(guards.claim("contact")).toBe(true);
  });
});

describe("the not-found route", () => {
  const reportNotFound = (state: ManagerState, route: string) => reducer(state, { type: "notFound", route });

  test("records the route without changing the open windows or focus", () => {
    const initialState = opened("collection", "entry");
    const state = reportNotFound(initialState, "/no-such-page");

    expect(state.notFoundRoute).toBe("/no-such-page");
    expect(state.focused).toBe("entry");
    expect(state.content).toBe(initialState.content);
    expect(state.order).toBe(initialState.order);
  });

  test("repeating the same route is a no-op, while a different route replaces it", () => {
    const state = reportNotFound(opened("entry"), "/no-such-page");

    expect(reportNotFound(state, "/no-such-page")).toBe(state);
    expect(reportNotFound(state, "/another-typo").notFoundRoute).toBe("/another-typo");
  });

  test("clears the route when dismissed, but not when a window closes", () => {
    const state = reportNotFound(opened("entry"), "/no-such-page");

    expect(reducer(state, { type: "dismissNotFound" }).notFoundRoute).toBeNull();
    expect(reducer(state, { type: "close", id: "entry" }).notFoundRoute).toBe("/no-such-page");
  });

  test("dismisses to the window that was previously focused", () => {
    const state = reportNotFound(opened("entry"), "/no-such-page");
    expect(reducer(state, { type: "dismissNotFound" }).focused).toBe("entry");
  });

  test("dismissing when there is no not-found route is a no-op", () => {
    const state = opened("entry");
    expect(reducer(state, { type: "dismissNotFound" })).toBe(state);
  });

  test("clears the route when navigation resolves to a real destination", () => {
    const state = reportNotFound(opened("entry"), "/no-such-page");

    expect(reducer(state, openAction("collection", "/tech-notes")).notFoundRoute).toBeNull();
    expect(reducer(state, openAction("entry", "/entry")).notFoundRoute).toBeNull();
    expect(reducer(state, { type: "focusDesktop" }).notFoundRoute).toBeNull();
  });
});
