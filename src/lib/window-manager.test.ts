import { describe, expect, test } from "vitest";

import { EMPTY_STATE, createWindowReducer } from "./window-manager";

import type { ManagerState, WindowLayout } from "./window-manager";

const LAYOUT: WindowLayout = {
  defaultPosition: { collection: { x: 16, y: 16 }, content: { x: 512, y: 16 } },
  defaultSize: { collection: { width: 480, height: 420 }, content: { width: 720, height: 640 } },
  minSize: { width: 280, height: 160 },
  cascadeOffset: 28,
  maxCascadeSteps: 8,
};

const reducer = createWindowReducer(LAYOUT);

function opened(...routes: Array<string>): ManagerState {
  return routes.reduce(
    (state, route) => reducer(state, { type: "open", route, title: route, kind: "collection" }),
    EMPTY_STATE,
  );
}

describe("open", () => {
  test("adds the window, raises it to the front, and makes it active", () => {
    const state = opened("/work");

    expect(state.order).toEqual(["/work"]);
    expect(state.focused).toBe("/work");
    expect(state.windows["/work"]?.title).toBe("/work");
  });

  test("cascades each new window", () => {
    const state = opened("/work", "/about");

    expect(state.windows["/about"]!.x).toBeGreaterThan(state.windows["/work"]!.x);
    expect(state.windows["/about"]!.y).toBeGreaterThan(state.windows["/work"]!.y);
  });

  test("each kind cascades from its own base position", () => {
    const state = reducer(opened("/work"), { type: "open", route: "/about", title: "About", kind: "content" });

    expect(state.windows["/work"]).toMatchObject(LAYOUT.defaultPosition.collection);
    expect(state.windows["/about"]).toMatchObject(LAYOUT.defaultPosition.content);
  });

  test("a closed window frees its slot for the next window", () => {
    const initialState = reducer(opened("/work", "/about"), { type: "close", route: "/work" });
    const mutatedState = reducer(initialState, {
      type: "open",
      route: "/contact",
      title: "Contact",
      kind: "collection",
    });

    // /work held the base slot, so /contact takes it rather than cascading past /about.
    expect(mutatedState.windows["/contact"]).toMatchObject(LAYOUT.defaultPosition.collection);
  });

  test("the base position is not mutated by a cascade", () => {
    const defaultPosition = { ...LAYOUT.defaultPosition.collection };

    opened("/work", "/about", "/contact");
    expect(LAYOUT.defaultPosition.collection).toEqual(defaultPosition);
  });

  test("an open route is re-focused, not duplicated", () => {
    const state = reducer(opened("/work", "/about"), {
      type: "open",
      route: "/work",
      title: "ignored",
      kind: "collection",
    });

    expect(state.order).toEqual(["/about", "/work"]);
    expect(state.focused).toBe("/work");
    expect(state.windows["/work"]?.title).toBe("/work");
  });
});

describe("close", () => {
  test("hands the focus to the next window in the stack", () => {
    const state = reducer(opened("/work", "/about"), { type: "close", route: "/about" });

    expect(state.order).toEqual(["/work"]);
    expect(state.focused).toBe("/work");
    expect(state.windows["/about"]).toBeUndefined();
  });

  test("closing the last window makes the desktop active", () => {
    expect(reducer(opened("/work"), { type: "close", route: "/work" }).focused).toBeNull();
  });

  test("closing an inactive window retains the existing focus", () => {
    const state = reducer(opened("/work", "/about"), { type: "close", route: "/work" });
    expect(state.focused).toBe("/about");
  });

  test("an unknown route is a no-op", () => {
    const state = opened("/work");
    expect(reducer(state, { type: "close", route: "/unknown-route" })).toBe(state);
  });
});

describe("focus", () => {
  test("raises the window to the front of the stack", () => {
    const state = reducer(opened("/work", "/about"), { type: "focus", route: "/work" });

    expect(state.order).toEqual(["/about", "/work"]);
    expect(state.focused).toBe("/work");
  });

  test("re-focusing the topmost window does not affect state", () => {
    const state = opened("/work", "/about");
    expect(reducer(state, { type: "focus", route: "/about" })).toBe(state);
  });

  test("an unknown route is a no-op", () => {
    const state = opened("/work");
    expect(reducer(state, { type: "focus", route: "/unknown-route" })).toBe(state);
  });
});

describe("move", () => {
  test("sets the position and leaves the size unchanged", () => {
    const initialState = opened("/work");
    const mutatedState = reducer(initialState, { type: "move", route: "/work", x: 50, y: 50 });

    expect(mutatedState.windows["/work"]).toMatchObject({ x: 50, y: 50, width: initialState.windows["/work"]!.width });
  });

  test("an unknown route is a no-op", () => {
    const state = opened("/work");
    expect(reducer(state, { type: "move", route: "/nope", x: 1, y: 2 })).toBe(state);
  });
});

describe("resize", () => {
  test("sets the desired size", () => {
    const state = reducer(opened("/work"), { type: "resize", route: "/work", width: 640, height: 480 });
    expect(state.windows["/work"]).toMatchObject({ width: 640, height: 480 });
  });

  test("clamps the size to the minimum size", () => {
    const state = reducer(opened("/work"), { type: "resize", route: "/work", width: 10, height: 10 });

    expect(state.windows["/work"]!.width).toBe(LAYOUT.minSize.width);
    expect(state.windows["/work"]!.height).toBe(LAYOUT.minSize.height);
  });
});

describe("zoom", () => {
  test("toggles maximized and raises the window", () => {
    const state = reducer(opened("/about", "/work"), { type: "zoom", route: "/about" });

    expect(state.windows["/about"]!.maximized).toBe(true);
    expect(state.order).toEqual(["/work", "/about"]);
    expect(state.focused).toBe("/about");

    expect(reducer(state, { type: "zoom", route: "/about" }).windows["/about"]!.maximized).toBe(false);
  });

  test("an unknown route is a no-op", () => {
    const state = opened("/work");
    expect(reducer(state, { type: "zoom", route: "/nope" })).toBe(state);
  });
});

describe("organize", () => {
  test("un-maximizes and re-cascades every window in stack order", () => {
    const zoomedState = reducer(opened("/work", "/about"), { type: "zoom", route: "/work" });
    const movedState = reducer(zoomedState, { type: "move", route: "/work", x: 999, y: 999 });
    const organizedState = reducer(movedState, { type: "organize" });

    // Zooming raised /work, so the cascade now runs /about, then /work.
    expect(organizedState.order).toEqual(["/about", "/work"]);
    expect(organizedState.windows["/work"]!.maximized).toBe(false);
    expect(organizedState.windows["/work"]!.x).toBeGreaterThan(organizedState.windows["/about"]!.x);
    expect(organizedState.windows["/work"]!.y).toBeGreaterThan(organizedState.windows["/about"]!.y);
  });

  test("raises the content windows above collection windows, each group from its own base position", () => {
    const initialState = reducer(
      reducer(EMPTY_STATE, { type: "open", route: "/about", title: "About", kind: "content" }),
      {
        type: "open",
        route: "/work",
        title: "Work",
        kind: "collection",
      },
    );
    const mutatedState = reducer(initialState, { type: "organize" });

    expect(initialState.order).toEqual(["/about", "/work"]);
    expect(mutatedState.order).toEqual(["/work", "/about"]);
    expect(mutatedState.windows["/work"]).toMatchObject(LAYOUT.defaultPosition.collection);
    expect(mutatedState.windows["/about"]).toMatchObject(LAYOUT.defaultPosition.content);
  });

  test("the front window takes the focus", () => {
    const state = reducer(reducer(EMPTY_STATE, { type: "open", route: "/about", title: "About", kind: "content" }), {
      type: "open",
      route: "/work",
      title: "Work",
      kind: "collection",
    });

    expect(state.focused).toBe("/work");
    expect(reducer(state, { type: "organize" }).focused).toBe("/about");
  });

  test("keeps the desktop focused if it was already focused", () => {
    const state = reducer(reducer(opened("/work"), { type: "focusDesktop" }), { type: "organize" });

    expect(state.focused).toBeNull();
    expect(state.order).toEqual(["/work"]);
  });

  test("the first window returns to the base position", () => {
    const initialState = opened("/work");
    const movedState = reducer(initialState, { type: "move", route: "/work", x: 999, y: 999 });
    const organizedState = reducer(movedState, { type: "organize" });

    expect(organizedState.windows["/work"]).toMatchObject({
      x: initialState.windows["/work"]!.x,
      y: initialState.windows["/work"]!.y,
    });
  });
});

describe("focusDesktop", () => {
  test("keeps the windows open and makes the desktop active", () => {
    const initialState = opened("/work", "/about");
    const mutatedState = reducer(initialState, { type: "focusDesktop" });

    expect(mutatedState.focused).toBeNull();
    expect(mutatedState.order).toEqual(["/work", "/about"]);
    expect(mutatedState.windows).toBe(initialState.windows);
  });

  test("is a no-op when the desktop is already active", () => {
    const state = reducer(opened("/work"), { type: "focusDesktop" });
    expect(reducer(state, { type: "focusDesktop" })).toBe(state);
  });
});
