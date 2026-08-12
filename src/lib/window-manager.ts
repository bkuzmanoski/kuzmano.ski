import { createContext, use } from "react";

import { constrain } from "./geometry";

import type { Rect, Size } from "./geometry";

/**
 * The windows the desktop can open. Every route resolves to exactly one of them,
 * and each one exists at most once: a route that resolves to an open window
 * replaces what that window shows instead of opening a second one.
 */
export type WindowId = "collection" | "page" | "notFound";

/** Every window id, in the order the window layer writes them to the DOM. */
export const WINDOW_IDS = ["collection", "page", "notFound"] as const satisfies ReadonlyArray<WindowId>;

/** A value held per window. A missing entry means that window is closed. */
export type WindowRecord<T> = Partial<Record<WindowId, T>>;

/** What a window shows. Rewritten only when the window opens or navigates. */
export interface WindowContent {
  route: string;
  title: string;
}

/** Where a window is placed. Rewritten on every frame of a drag. */
export interface WindowGeometry extends Rect {
  maximized: boolean;
}

export interface WindowLayout {
  defaultSize: Size;
  minSize: Size;
  cascadeOffset: number;
  padding: number;
}

export interface ManagerState {
  content: WindowRecord<WindowContent>;
  geometry: WindowRecord<WindowGeometry>;
  order: Array<WindowId>;
  focused: WindowId | null; // `null` means the desktop has focus.
  surface: Size; // {0, 0} until the window layer has measured it.
}

export type Action =
  | { type: "open"; id: WindowId; route: string; title: string }
  | { type: "close"; id: WindowId }
  | { type: "focus"; id: WindowId }
  | { type: "move"; id: WindowId; x: number; y: number }
  | { type: "resize"; id: WindowId; width: number; height: number }
  | { type: "zoom"; id: WindowId }
  | { type: "measure"; surface: Size }
  | { type: "organize" }
  | { type: "focusDesktop" };

export const EMPTY_STATE: ManagerState = {
  content: {},
  geometry: {},
  order: [],
  focused: null,
  surface: { width: 0, height: 0 },
};

function focusWindow(state: ManagerState, id: WindowId): ManagerState {
  if (!state.content[id]) {
    return state;
  }

  if (state.focused === id && state.order.at(-1) === id) {
    return state;
  }

  return { ...state, order: [...state.order.filter((open) => open !== id), id], focused: id };
}

function updateGeometry(state: ManagerState, id: WindowId, patch: Partial<WindowGeometry>): ManagerState {
  const target = state.geometry[id];

  if (!target) {
    return state;
  }

  return { ...state, geometry: { ...state.geometry, [id]: { ...target, ...patch } } };
}

/**
 * The position of cascade slot `step`.
 *
 * The halves are left unrounded so that they match, to the pixel, where CSS centres a
 * pre-rendered window (see `.unplaced` in `window.module.css`).
 */
function cascadeSlot(layout: WindowLayout, surface: Size, step: number): Rect {
  const offset = step * layout.cascadeOffset;

  /* An unmeasured desktop has no padded area to fit into. CSS places what the server
   * drew, and the first measurement re-places it (see the `measure` case). */
  if (surface.width === 0 || surface.height === 0) {
    return { x: offset, y: offset, ...layout.defaultSize };
  }

  const x = Math.max(layout.padding, (surface.width - layout.defaultSize.width) / 2) + offset;
  const y = Math.max(layout.padding, (surface.height - layout.defaultSize.height) / 2) + offset;

  return {
    x,
    y,
    width: Math.min(layout.defaultSize.width, surface.width - layout.padding - x),
    height: Math.min(layout.defaultSize.height, surface.height - layout.padding - y),
  };
}

/** The first unoccupied cascade slot. */
function freeCascadeSlot(layout: WindowLayout, state: ManagerState): Rect {
  const openWindows = Object.values(state.geometry);

  for (let step = 0; step < WINDOW_IDS.length; step++) {
    const position = cascadeSlot(layout, state.surface, step);

    if (!openWindows.some((window) => window.x === position.x && window.y === position.y)) {
      return position;
    }
  }

  return cascadeSlot(layout, state.surface, 0);
}

/* Every open window cascaded from the centre of the desktop, back to front,
 * at its existing size unless that size overflows the slot it lands in. */
function cascadeWindows(layout: WindowLayout, state: ManagerState): WindowRecord<WindowGeometry> {
  const geometry: WindowRecord<WindowGeometry> = {};

  state.order.forEach((id, step) => {
    const target = state.geometry[id];

    if (target) {
      const slot = cascadeSlot(layout, state.surface, step);

      geometry[id] = {
        ...slot,
        width: Math.min(target.width, slot.width),
        height: Math.min(target.height, slot.height),
        maximized: false,
      };
    }
  });

  return geometry;
}

export type WindowReducer = (state: ManagerState, action: Action) => ManagerState;

/** The app dispatches through the provider; the reducer is built here so it can be unit tested. */
export function createWindowReducer(layout: WindowLayout): WindowReducer {
  return function reducer(state: ManagerState, action: Action): ManagerState {
    switch (action.type) {
      case "open": {
        const { id, route, title } = action;
        const current = state.content[id];
        const content = current?.route === route ? state.content : { ...state.content, [id]: { route, title } };

        if (current) {
          const raised = focusWindow(state, id); // The window is already open, so it shows the new route in place and comes to the front.
          return content === state.content ? raised : { ...raised, content };
        }

        return {
          ...state,
          content,
          geometry: {
            ...state.geometry,
            [id]: { ...freeCascadeSlot(layout, state), maximized: false },
          },
          order: [...state.order, id],
          focused: id,
        };
      }
      case "close": {
        if (!state.content[action.id]) {
          return state;
        }

        const { [action.id]: _closedContent, ...content } = state.content;
        const { [action.id]: _closedGeometry, ...geometry } = state.geometry;
        const order = state.order.filter((open) => open !== action.id);
        const focused = state.focused === action.id ? (order.at(-1) ?? null) : state.focused;

        return { ...state, content, geometry, order, focused };
      }
      case "focus": {
        return focusWindow(state, action.id);
      }
      case "move": {
        const target = state.geometry[action.id];

        if (!target) {
          return state;
        }

        const constrainedRect = constrain({ ...target, x: action.x, y: action.y }, state.surface);

        return updateGeometry(state, action.id, { x: constrainedRect.x, y: constrainedRect.y });
      }
      case "resize": {
        const target = state.geometry[action.id];

        if (!target) {
          return state;
        }

        const constrainedRect = constrain(target, state.surface);
        const resized = {
          ...constrainedRect,
          width: Math.max(layout.minSize.width, action.width),
          height: Math.max(layout.minSize.height, action.height),
        };

        return updateGeometry(state, action.id, constrain(resized, state.surface));
      }
      case "zoom": {
        const target = state.geometry[action.id];

        if (!target) {
          return state;
        }

        return updateGeometry(focusWindow(state, action.id), action.id, { maximized: !target.maximized });
      }
      case "measure": {
        const { surface } = action;

        if (state.surface.width === surface.width && state.surface.height === surface.height) {
          return state;
        }

        const measured = { ...state, surface };

        /* A deep link opens its window before the desktop has been measured, so the first
         * measurement places what is already open. Subsequent measurements do not affect
         * windows; the window layer fits them to the desktop. */
        const isFirstMeasurement = state.surface.width === 0 || state.surface.height === 0;

        return isFirstMeasurement ? { ...measured, geometry: cascadeWindows(layout, measured) } : measured;
      }
      case "organize": {
        return { ...state, geometry: cascadeWindows(layout, state) };
      }
      case "focusDesktop": {
        return state.focused === null ? state : { ...state, focused: null };
      }
    }
  };
}

export interface WindowActions {
  open: (route: string) => void;
  close: (id: WindowId) => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, x: number, y: number) => void;
  resize: (id: WindowId, width: number, height: number) => void;
  toggleZoom: (id: WindowId) => void;
  measure: (surface: Size) => void;
  organize: () => void;
  focusDesktop: () => void;
}

/* The state is split across six contexts so a change reaches only the parts that
 * use it. A window drag rewrites `geometry` many times per second; keeping window
 * content, the order, and the focus state separate means the menu bar, status items
 * and desktop icons do not re-render with it.
 *
 * They are exported for `window-manager-provider`, which is the only thing that
 * writes to them. Everything else reads through the hooks below. */
export const ActionsContext = createContext<WindowActions | null>(null);
export const ContentContext = createContext<WindowRecord<WindowContent>>({});
export const GeometryContext = createContext<WindowRecord<WindowGeometry>>({});
export const OrderContext = createContext<Array<WindowId>>([]);
export const FocusContext = createContext<WindowId | null>(null);
export const SurfaceContext = createContext<Size>(EMPTY_STATE.surface);

export function useWindowActions(): WindowActions {
  const actions = use(ActionsContext);

  if (!actions) {
    throw new Error("`useWindowActions` must be used within a `WindowManagerProvider`.");
  }

  return actions;
}

/** What each open window shows. Changes when a window opens, closes, or navigates. */
export function useWindowContent(): WindowRecord<WindowContent> {
  return use(ContentContext);
}

/** Where each open window is placed. Changes on move and resize. */
export function useWindowGeometry(): WindowRecord<WindowGeometry> {
  return use(GeometryContext);
}

/** Open windows, back to front. Changes when a window opens, closes, or is raised. */
export function useWindowOrder(): Array<WindowId> {
  return use(OrderContext);
}

/** The active window, or null when the desktop is active. */
export function useFocusedWindow(): WindowId | null {
  return use(FocusContext);
}

/**
 * The size of the desktop the windows are placed on, {0, 0} until it has been measured.
 * It comes from the manager rather than the DOM so that it and the geometry it produced
 * always agree, however many renders the measurement takes to arrive.
 */
export function useSurface(): Size {
  return use(SurfaceContext);
}
