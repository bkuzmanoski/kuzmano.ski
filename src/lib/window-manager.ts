import { createContext, use } from "react";

import { clamp } from "./math";

import type { Position, Rect, Size } from "./geometry";

/**
 * Every window id, in the order the window layer writes them to the DOM. Stacking is `order`.
 */
export const WINDOW_DOM_ORDER = ["collection", "entry", "contact"] as const;

export type WindowId = (typeof WINDOW_DOM_ORDER)[number];

const WINDOW_COUNT = WINDOW_DOM_ORDER.length; // The most windows that can be open at once.

export interface Destination {
  type: WindowId;
  title: string;
  route: string;
}

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

export interface WindowSpec {
  defaultSize: Size;
  openAt: "cascade" | "center";
  fixedSize: boolean; // A fixed-size window has no zoom control and no resize handle.
}

export interface WindowLayout {
  windows: Record<WindowId, WindowSpec>;
  minSize: Size;
  cascadeOffset: Position;
  padding: number;
}

export interface ManagerState {
  content: WindowRecord<WindowContent>;
  geometry: WindowRecord<WindowGeometry>;
  order: Array<WindowId>; // Back to front, so the last is on top.
  focused: WindowId | null; // `null` means the desktop has focus.
  surface: Size; // {0, 0} until the window layer has measured it.
  notFoundRoute: string | null; // The route the desktop is reporting as missing, or `null` when there is nothing to report
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
  | { type: "cycleWindows" }
  | { type: "focusDesktop" }
  | { type: "notFound"; route: string }
  | { type: "dismissNotFound" };

export const EMPTY_STATE: ManagerState = {
  content: {},
  geometry: {},
  order: [],
  focused: null,
  surface: { width: 0, height: 0 },
  notFoundRoute: null,
};

/** Whether window layer has reported the size of the desktop yet. */
export function isUnmeasured(surface: Size): boolean {
  return surface.width === 0 || surface.height === 0;
}

function updateGeometry(
  state: ManagerState,
  id: WindowId,
  patch: (target: WindowGeometry) => Partial<WindowGeometry>,
): ManagerState {
  const target = state.geometry[id];

  if (!target) {
    return state;
  }

  return { ...state, geometry: { ...state.geometry, [id]: { ...target, ...patch(target) } } };
}

/**
 * One axis of a cascade slot: the window's default extent, centered and then stepped along the
 * axis, constrained to what is left inside the padding. Since a step spends space the window
 * could otherwise fill, one that would take it below its minimum extent is dropped in full,
 * leaving the window centered on that axis alone.
 *
 * The result is left unrounded so that it matches, to the pixel, where CSS centers a
 * pre-rendered window (see `.unplaced` in `window.module.css`).
 */
function cascadeAxis(
  padding: number,
  surfaceLength: number,
  defaultLength: number,
  minLength: number,
  offset: number,
): { position: number; extent: number } {
  const center = Math.max(padding, (surfaceLength - defaultLength) / 2);
  const extentAt = (position: number) => Math.min(defaultLength, surfaceLength - padding - position);
  const stepped = center + offset;
  const position = extentAt(stepped) < minLength ? center : stepped;

  return { position, extent: extentAt(position) };
}

/**
 * A window's default size stepped down and to the right of center, constrained to the
 * available space. A slot is already placed, so `createWindowPlacer` returns it unchanged.
 */
function cascadeSlot(layout: WindowLayout, surface: Size, id: WindowId, step: number): Rect {
  const { defaultSize } = layout.windows[id];
  const offsetX = step * layout.cascadeOffset.x;
  const offsetY = step * layout.cascadeOffset.y;

  // An unmeasured desktop has no padded area to fit into. CSS places what the server
  // rendered, and the first measurement re-places it (see the `measure` case).
  if (isUnmeasured(surface)) {
    return { x: offsetX, y: offsetY, ...defaultSize };
  }

  const { padding, minSize } = layout;
  const horizontal = cascadeAxis(padding, surface.width, defaultSize.width, minSize.width, offsetX);
  const vertical = cascadeAxis(padding, surface.height, defaultSize.height, minSize.height, offsetY);

  return {
    x: horizontal.position,
    y: vertical.position,
    width: horizontal.extent,
    height: vertical.extent,
  };
}

/**
 * Where a window opens. A cascading window takes the first slot no open window stands on, so
 * it is never hidden behind one the same size; a centered window always opens in the middle.
 */
function openSlot(layout: WindowLayout, state: ManagerState, id: WindowId): Rect {
  const slotAt = (step: number) => cascadeSlot(layout, state.surface, id, step);

  if (layout.windows[id].openAt === "center") {
    return slotAt(0);
  }

  const openWindows = Object.values(state.geometry);

  for (let step = 0; step < WINDOW_COUNT; step++) {
    const slot = slotAt(step);

    if (!openWindows.some((window) => window.x === slot.x && window.y === slot.y)) {
      return slot;
    }
  }

  return slotAt(0);
}

// Every open window cascaded from the center of the desktop, back to front, at its existing
// size unless that size overflows the slot it lands in. Organizing is a deliberate tidy-up
// of the whole desktop, so it cascades windows that would open in the center as well.
function cascadeWindows(layout: WindowLayout, state: ManagerState): WindowRecord<WindowGeometry> {
  const geometry: WindowRecord<WindowGeometry> = {};

  state.order.forEach((id, step) => {
    const target = state.geometry[id];

    if (target) {
      const slot = cascadeSlot(layout, state.surface, id, step);
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

function clearNotFound(state: ManagerState): ManagerState {
  return state.notFoundRoute === null ? state : { ...state, notFoundRoute: null };
}

function focusWindow(state: ManagerState, id: WindowId): ManagerState {
  if (!state.content[id]) {
    return state;
  }

  if (state.focused === id && state.order.at(-1) === id) {
    return state;
  }

  return { ...state, order: [...state.order.filter((open) => open !== id), id], focused: id };
}

/** How a window is positioned and sized on a desktop of a given size. Bound to a layout by `createWindowPlacer`. */
export type WindowPlacer = (geometry: Rect, surface: Size) => Rect;

export function createWindowPlacer(layout: WindowLayout): WindowPlacer {
  return function placeWindow(geometry, surface) {
    if (isUnmeasured(surface)) {
      return geometry;
    }

    const width = Math.min(geometry.width, Math.max(0, surface.width - 2 * layout.padding));
    const height = Math.min(geometry.height, Math.max(0, surface.height - 2 * layout.padding));

    return {
      x: clamp(geometry.x, layout.padding, surface.width - layout.padding - width),
      y: clamp(geometry.y, layout.padding, surface.height - layout.padding - height),
      width,
      height,
    };
  };
}

export type WindowReducer = (state: ManagerState, action: Action) => ManagerState;

/** The app dispatches through the provider; the reducer is built here so it can be unit tested. */
export function createWindowReducer(layout: WindowLayout): WindowReducer {
  const placeWindow = createWindowPlacer(layout);

  return function reducer(state: ManagerState, action: Action): ManagerState {
    switch (action.type) {
      case "open": {
        const { id, route, title } = action;
        const current = state.content[id];
        const content = current?.route === route ? state.content : { ...state.content, [id]: { route, title } };

        if (current) {
          const raised = focusWindow(state, id); // The window is already open, so it shows the new route in place and comes to the front.
          return clearNotFound(content === state.content ? raised : { ...raised, content });
        }

        return {
          ...state,
          content,
          geometry: {
            ...state.geometry,
            [id]: { ...openSlot(layout, state, id), maximized: false },
          },
          order: [...state.order, id],
          focused: id,
          notFoundRoute: null,
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
        return updateGeometry(state, action.id, (target) => {
          const { x, y } = placeWindow({ ...target, x: action.x, y: action.y }, state.surface);
          return { x, y };
        });
      }

      case "resize": {
        return updateGeometry(state, action.id, (target) => {
          const placedRect = placeWindow(target, state.surface);
          const resizedRect = {
            ...placedRect,
            width: Math.max(layout.minSize.width, action.width),
            height: Math.max(layout.minSize.height, action.height),
          };

          return placeWindow(resizedRect, state.surface);
        });
      }

      case "zoom": {
        return updateGeometry(focusWindow(state, action.id), action.id, (target) => ({
          maximized: !target.maximized,
        }));
      }

      case "measure": {
        const { surface } = action;

        if (state.surface.width === surface.width && state.surface.height === surface.height) {
          return state;
        }

        const measured = { ...state, surface };

        // A deep link opens its window before the desktop has been measured, so the first
        // measurement places what is already open. Subsequent measurements do not affect
        // windows; the window layer fits them to the desktop.
        const isFirstMeasurement = isUnmeasured(state.surface);

        return isFirstMeasurement ? { ...measured, geometry: cascadeWindows(layout, measured) } : measured;
      }

      case "organize": {
        return { ...state, geometry: cascadeWindows(layout, state) };
      }

      case "cycleWindows": {
        const next = state.focused === null ? state.order.at(-1) : state.order[0];
        return next ? focusWindow(state, next) : state;
      }

      case "focusDesktop": {
        return clearNotFound(state.focused === null ? state : { ...state, focused: null });
      }

      case "notFound": {
        return state.notFoundRoute === action.route ? state : { ...state, notFoundRoute: action.route };
      }

      case "dismissNotFound": {
        return clearNotFound(state);
      }
    }
  };
}

export interface OpenOptions {
  replaceUrl?: boolean;
}

export interface CloseOptions {
  force?: boolean;
}

/**
 * Guards a window close request.
 *
 * Returning `true` claims the request and keeps the window open. The guard must then
 * complete the close using the function returned by `useCloseGuard`.
 */
export type CloseGuard = () => boolean;

export interface WindowActions {
  open: (route: string, options?: OpenOptions) => void;
  close: (id: WindowId, options?: CloseOptions) => void;
  registerCloseGuard: (id: WindowId, guard: CloseGuard) => () => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, x: number, y: number) => void;
  resize: (id: WindowId, width: number, height: number) => void;
  toggleZoom: (id: WindowId) => void;
  measure: (surface: Size) => void;
  organize: () => void;
  cycleWindows: () => void;
  focusDesktop: () => void;
  showNotFound: (route: string) => void;
  dismissNotFound: () => void;
}

/**
 * Registry of close guards for window bodies.
 *
 * Uses mutable state because `close` reads the current guard when a
 * request is made; the registry itself does not affect rendering.
 */
export interface CloseGuards {
  register: (id: WindowId, guard: CloseGuard) => () => void;
  claim: (id: WindowId) => boolean; // Invokes the window's guard and returns whether it claimed the close request.
}

export function createCloseGuards(): CloseGuards {
  const guards = new Map<WindowId, CloseGuard>();

  return {
    register(id, guard) {
      guards.set(id, guard);
      return () => {
        if (guards.get(id) === guard) {
          guards.delete(id);
        }
      };
    },
    claim: (id) => guards.get(id)?.() === true,
  };
}

// The state is split across seven contexts so a change reaches only the parts that
// use it. A window drag rewrites `geometry` many times per second; keeping window
// content, the order, and the focus state separate means the menu bar, status items
// and desktop icons do not re-render with it.
export const ActionsContext = createContext<WindowActions | null>(null);
export const ContentContext = createContext<WindowRecord<WindowContent>>({});
export const GeometryContext = createContext<WindowRecord<WindowGeometry>>({});
export const OrderContext = createContext<Array<WindowId>>([]);
export const FocusContext = createContext<WindowId | null>(null);
export const SurfaceContext = createContext<Size>(EMPTY_STATE.surface);
export const NotFoundContext = createContext<string | null>(null);

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

/** The route the desktop is reporting as missing, or null when there is nothing to report. */
export function useNotFoundRoute(): string | null {
  return use(NotFoundContext);
}
