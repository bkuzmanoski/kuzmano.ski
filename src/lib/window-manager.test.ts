import { describe, expect, test } from "vitest";

import { EMPTY_STATE, createWindowReducer } from "./window-manager";

import type { Action, ManagerState, WindowId, WindowLayout } from "./window-manager";

const LAYOUT: WindowLayout = {
  defaultSize: { width: 720, height: 560 },
  minSize: { width: 480, height: 280 },
  cascadeOffset: 28,
};

const SURFACE = { width: 1280, height: 800 };
const CENTRE_POSITION = {
  x: (SURFACE.width - LAYOUT.defaultSize.width) / 2,
  y: (SURFACE.height - LAYOUT.defaultSize.height) / 2,
};

const reducer = createWindowReducer(LAYOUT);

const openAction = (id: WindowId, route: string): Action => ({ type: "open", id, route, title: route });

function opened(...ids: Array<WindowId>): ManagerState {
  return ids.reduce(
    (state, id) => reducer(state, openAction(id, `/${id}`)),
    reducer(EMPTY_STATE, { type: "measure", surface: SURFACE }),
  );
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
    });
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

  test("a window wider than the desktop takes the position it is rendered at", () => {
    const narrowSurface = { width: 600, height: 800 };
    const initialState = reducer(opened("page"), { type: "measure", surface: narrowSurface });
    const mutatedState = reducer(initialState, { type: "resize", id: "page", width: 560, height: 400 });

    expect(initialState.geometry.page).toMatchObject({ x: CENTRE_POSITION.x, width: LAYOUT.defaultSize.width });
    expect(mutatedState.geometry.page).toMatchObject({ x: 0, width: 560 });
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

    expect(preRendered.geometry.page).toMatchObject({ x: 0, y: 0 });
    expect(measured.geometry.page).toMatchObject(CENTRE_POSITION);
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
