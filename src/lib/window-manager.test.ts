import { describe, expect, test } from "vitest";

import { EMPTY_STATE, WINDOW_IDS, createWindowPlacer, createWindowReducer } from "./window-manager";

import type { Size } from "./geometry";
import type { Action, ManagerState, WindowId, WindowLayout } from "./window-manager";

const LAYOUT: WindowLayout = {
  defaultSize: { width: 1024, height: 1024 },
  minSize: { width: 480, height: 320 },
  cascadeOffset: 28,
  padding: 8,
};

const SURFACE = { width: 1600, height: 1200 }; // Room for the default size plus a cascade step on every edge.
const CENTRE_POSITION = {
  x: (SURFACE.width - LAYOUT.defaultSize.width) / 2,
  y: (SURFACE.height - LAYOUT.defaultSize.height) / 2,
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
    const state = opened("page");

    expect(state.order).toEqual(["page"]);
    expect(state.focused).toBe("page");
    expect(state.content.page).toEqual({ route: "/page", title: "/page" });
  });

  test("the first window is centred on the desktop and subsequent windows cascade from there", () => {
    const state = opened("page", "collection");

    expect(state.geometry.page).toMatchObject({ ...CENTRE_POSITION, ...LAYOUT.defaultSize });
    expect(state.geometry.collection).toMatchObject({
      x: CENTRE_POSITION.x + LAYOUT.cascadeOffset,
      y: CENTRE_POSITION.y + LAYOUT.cascadeOffset,
      ...LAYOUT.defaultSize, // A desktop with room to spare places both windows at the default size.
    });
  });

  test("resizes a window down to fit the available space", () => {
    const state = openedOn({ width: 600, height: 400 }, "page");

    expect(state.geometry.page).toMatchObject({
      x: LAYOUT.padding,
      y: LAYOUT.padding,
      width: 600 - 2 * LAYOUT.padding,
      height: 400 - 2 * LAYOUT.padding,
    });
  });

  test("resizes a cascaded window to fit the available space", () => {
    const surface = { width: 1080, height: 1080 };
    const state = openedOn(surface, "page", "collection");

    expect(state.geometry.page).toMatchObject({ x: 28, y: 28, ...LAYOUT.defaultSize });
    expect(state.geometry.collection).toMatchObject({ x: 56, y: 56, width: 1016, height: 1016 });
  });

  test("opens every window at a position and size that fits within the desktop", () => {
    const state = opened(...WINDOW_IDS);
    const placeWindow = createWindowPlacer(LAYOUT);

    for (const id of WINDOW_IDS) {
      const { maximized: _maximized, ...geometry } = state.geometry[id]!;
      const placedRect = placeWindow(geometry, SURFACE);
      expect(placedRect).toEqual(geometry); // Cascade slots are placed already so an opened window does not move.
    }
  });

  test("a closed window frees its slot for the next window", () => {
    const initialState = reducer(opened("page", "collection"), { type: "close", id: "page" });
    const mutatedState = reducer(initialState, openAction("notFound", "/typo"));

    // The page window held the base slot, so the 404 takes it rather than cascading past the collection.
    expect(mutatedState.geometry.notFound).toMatchObject(CENTRE_POSITION);
  });

  test("a route that resolves to an existing window replaces what it shows in place", () => {
    const initialState = opened("collection", "page");
    const mutatedState = reducer(initialState, openAction("collection", "/design-notes/entry"));

    expect(mutatedState.order).toEqual(["page", "collection"]);
    expect(mutatedState.focused).toBe("collection");
    expect(mutatedState.content.collection).toEqual({ route: "/design-notes/entry", title: "/design-notes/entry" });
    expect(mutatedState.geometry.collection).toEqual(initialState.geometry.collection);
  });

  test("re-opening the route a window already shows only raises it", () => {
    const initialState = opened("collection", "page");
    const mutatedState = reducer(initialState, openAction("collection", "/collection"));

    expect(mutatedState.order).toEqual(["page", "collection"]);
    expect(mutatedState.content).toBe(initialState.content);
  });
});

describe("close", () => {
  test("hands the focus to the next window in the stack", () => {
    const state = reducer(opened("collection", "page"), { type: "close", id: "page" });

    expect(state.order).toEqual(["collection"]);
    expect(state.focused).toBe("collection");
    expect(state.content.page).toBeUndefined();
    expect(state.geometry.page).toBeUndefined();
  });

  test("focuses the desktop when applied to the last open window", () => {
    expect(reducer(opened("page"), { type: "close", id: "page" }).focused).toBeNull();
  });

  test("retains the existing focus when applied to an inactive window", () => {
    const state = reducer(opened("collection", "page"), { type: "close", id: "collection" });
    expect(state.focused).toBe("page");
  });

  test("is a no-op on a closed window", () => {
    const state = opened("page");
    expect(reducer(state, { type: "close", id: "notFound" })).toBe(state);
  });
});

describe("focus", () => {
  test("raises the window to the front of the stack", () => {
    const state = reducer(opened("collection", "page"), { type: "focus", id: "collection" });

    expect(state.order).toEqual(["page", "collection"]);
    expect(state.focused).toBe("collection");
  });

  test("does not affect state when applied to a focused window", () => {
    const state = opened("collection", "page");
    expect(reducer(state, { type: "focus", id: "page" })).toBe(state);
  });

  test("is a no-op on a closed window", () => {
    const state = opened("page");
    expect(reducer(state, { type: "focus", id: "notFound" })).toBe(state);
  });
});

describe("move", () => {
  test("sets the position and leaves the size unchanged", () => {
    const state = reducer(opened("page"), { type: "move", id: "page", x: 50, y: 50 });
    expect(state.geometry.page).toMatchObject({ x: 50, y: 50, ...LAYOUT.defaultSize });
  });

  test("stops at the edge of the desktop rather than banking movement past it", () => {
    const state = reducer(opened("page"), { type: "move", id: "page", x: 5000, y: 5000 });

    expect(state.geometry.page).toMatchObject({
      x: SURFACE.width - LAYOUT.padding - LAYOUT.defaultSize.width,
      y: SURFACE.height - LAYOUT.padding - LAYOUT.defaultSize.height,
      ...LAYOUT.defaultSize,
    });
  });

  test("a closed window is a no-op", () => {
    const state = opened("page");
    expect(reducer(state, { type: "move", id: "notFound", x: 1, y: 2 })).toBe(state);
  });
});

describe("resize", () => {
  test("sets the size", () => {
    const state = reducer(opened("page"), { type: "resize", id: "page", width: 640, height: 480 });
    expect(state.geometry.page).toMatchObject({ width: 640, height: 480 });
  });

  test("clamps the size to the minimum size", () => {
    const state = reducer(opened("page"), { type: "resize", id: "page", width: 10, height: 10 });
    expect(state.geometry.page).toMatchObject(LAYOUT.minSize);
  });

  test("stops at the edge of the desktop rather than banking size past it", () => {
    const state = reducer(opened("page"), { type: "resize", id: "page", width: 5000, height: 5000 });
    expect(state.geometry.page).toMatchObject({
      x: LAYOUT.padding,
      y: LAYOUT.padding,
      width: SURFACE.width - 2 * LAYOUT.padding,
      height: SURFACE.height - 2 * LAYOUT.padding,
    });
  });

  test("a window wider than the desktop takes the position it is rendered at", () => {
    const narrowSurface = { width: 600, height: 800 };
    const initialState = reducer(opened("page"), { type: "measure", surface: narrowSurface });
    const mutatedState = reducer(initialState, { type: "resize", id: "page", width: 560, height: 400 });

    expect(initialState.geometry.page).toMatchObject({ x: CENTRE_POSITION.x, width: LAYOUT.defaultSize.width });
    expect(mutatedState.geometry.page).toMatchObject({ x: LAYOUT.padding, width: 560 });
  });
});

describe("zoom", () => {
  test("toggles maximized and raises the window", () => {
    const state = reducer(opened("page", "collection"), { type: "zoom", id: "page" });

    expect(state.geometry.page!.maximized).toBe(true);
    expect(state.order).toEqual(["collection", "page"]);
    expect(state.focused).toBe("page");
    expect(reducer(state, { type: "zoom", id: "page" }).geometry.page!.maximized).toBe(false);
  });

  test("is a no-op on a closed window", () => {
    const state = opened("page");
    expect(reducer(state, { type: "zoom", id: "notFound" })).toBe(state);
  });
});

describe("measure", () => {
  test("the first measurement matches the pre-rendered geometry", () => {
    const preRendered = reducer(EMPTY_STATE, openAction("page", "/page"));
    const measured = reducer(preRendered, { type: "measure", surface: SURFACE });

    expect(preRendered.geometry.page).toMatchObject({ x: 0, y: 0, ...LAYOUT.defaultSize });
    expect(measured.geometry.page).toMatchObject({ ...CENTRE_POSITION, ...LAYOUT.defaultSize });
  });

  test("the first measurement fits a pre-rendered window into the padded area", () => {
    const preRendered = reducer(EMPTY_STATE, openAction("page", "/page"));
    const measured = reducer(preRendered, { type: "measure", surface: { width: 600, height: 400 } });

    // What CSS drew before the desktop was measured (see `.unplaced` in `window.module.css`).
    expect(measured.geometry.page).toMatchObject({
      x: LAYOUT.padding,
      y: LAYOUT.padding,
      width: 600 - 2 * LAYOUT.padding,
      height: 400 - 2 * LAYOUT.padding,
    });
  });

  test("a subsequent measurement leaves the windows where they are", () => {
    const movedState = reducer(opened("page"), { type: "move", id: "page", x: 10, y: 10 });
    const measured = reducer(movedState, { type: "measure", surface: { width: 640, height: 480 } });

    expect(measured.geometry).toBe(movedState.geometry);
    expect(measured.surface).toEqual({ width: 640, height: 480 });
  });

  test("is a no-op when the size is unchanged", () => {
    const state = opened("page");
    expect(reducer(state, { type: "measure", surface: SURFACE })).toBe(state);
  });
});

describe("organize", () => {
  test("un-maximizes and re-cascades every window in stack order", () => {
    const zoomedState = reducer(opened("collection", "page"), { type: "zoom", id: "collection" });
    const movedState = reducer(zoomedState, { type: "move", id: "collection", x: 999, y: 999 });
    const organizedState = reducer(movedState, { type: "organize" });

    // Zooming raised the collection window, so the cascade now runs the page window, then it.
    expect(organizedState.order).toEqual(["page", "collection"]);
    expect(organizedState.geometry.collection!.maximized).toBe(false);
    expect(organizedState.geometry.page).toMatchObject(CENTRE_POSITION);
    expect(organizedState.geometry.collection).toMatchObject({
      x: CENTRE_POSITION.x + LAYOUT.cascadeOffset,
      y: CENTRE_POSITION.y + LAYOUT.cascadeOffset,
    });
  });

  test("resizes a window down to its cascade slot if it does not fit", () => {
    const enlargedState = reducer(opened("page", "collection"), {
      type: "resize",
      id: "page",
      width: 1200,
      height: 700,
    });
    const resizedState = reducer(enlargedState, { type: "resize", id: "collection", width: 500, height: 400 });
    const organizedState = reducer(resizedState, { type: "organize" });

    // The page window loses the width its slot cannot hold and keeps the height that fits.
    expect(organizedState.geometry.page).toMatchObject({
      ...CENTRE_POSITION,
      width: LAYOUT.defaultSize.width,
      height: 700,
    });
    expect(organizedState.geometry.collection).toMatchObject({
      x: CENTRE_POSITION.x + LAYOUT.cascadeOffset,
      y: CENTRE_POSITION.y + LAYOUT.cascadeOffset,
      width: 500,
      height: 400,
    });
  });

  test("keeps the focus where it was", () => {
    expect(reducer(opened("collection", "page"), { type: "organize" }).focused).toBe("page");
    expect(reducer(reducer(opened("page"), { type: "focusDesktop" }), { type: "organize" }).focused).toBeNull();
  });
});

describe("focusDesktop", () => {
  test("keeps the windows open and makes the desktop active", () => {
    const initialState = opened("collection", "page");
    const mutatedState = reducer(initialState, { type: "focusDesktop" });

    expect(mutatedState.focused).toBeNull();
    expect(mutatedState.order).toEqual(["collection", "page"]);
    expect(mutatedState.geometry).toBe(initialState.geometry);
  });

  test("is a no-op when the desktop is already active", () => {
    const state = reducer(opened("page"), { type: "focusDesktop" });
    expect(reducer(state, { type: "focusDesktop" })).toBe(state);
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
