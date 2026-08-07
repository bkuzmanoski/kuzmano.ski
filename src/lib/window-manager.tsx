import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { createContext, use, useEffect, useEffectEvent, useMemo, useReducer, useRef } from "react";

import { constrain } from "./geometry";
import { WINDOW_IDS, resolveWindow, windowRouteFor } from "./window-registry";

import type { Position, Rect, Size } from "./geometry";
import type { WindowId } from "./window-registry";
import type { ReactNode } from "react";

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
 * The position of cascade slot `step`, measured from a window centred on the desktop.
 *
 * The halves are left unrounded so that they match, to the pixel, where CSS centres a
 * pre-rendered window (see `.unplaced` in `window.module.css`).
 */
function cascadeSlot(layout: WindowLayout, surface: Size, step: number): Position {
  const offset = step * layout.cascadeOffset;

  return {
    x: Math.max(0, (surface.width - layout.defaultSize.width) / 2) + offset,
    y: Math.max(0, (surface.height - layout.defaultSize.height) / 2) + offset,
  };
}

/** The first unoccupied cascade slot. */
function freeCascadeSlot(layout: WindowLayout, state: ManagerState): Position {
  const openWindows = Object.values(state.geometry);

  for (let step = 0; step < WINDOW_IDS.length; step++) {
    const position = cascadeSlot(layout, state.surface, step);

    if (!openWindows.some((window) => window.x === position.x && window.y === position.y)) {
      return position;
    }
  }

  return cascadeSlot(layout, state.surface, 0);
}

/** Every open window cascaded from the centre of the desktop, back to front, at its existing size. */
function cascadeWindows(layout: WindowLayout, state: ManagerState): WindowRecord<WindowGeometry> {
  const geometry: WindowRecord<WindowGeometry> = {};

  state.order.forEach((id, step) => {
    const target = state.geometry[id];

    if (target) {
      geometry[id] = { ...target, ...cascadeSlot(layout, state.surface, step), maximized: false };
    }
  });

  return geometry;
}

export type WindowReducer = (state: ManagerState, action: Action) => ManagerState;

/** Exported for unit tests; the app dispatches through the provider. */
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
            [id]: { ...freeCascadeSlot(layout, state), ...layout.defaultSize, maximized: false },
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
        return updateGeometry(state, action.id, { x: action.x, y: action.y });
      }
      case "resize": {
        const target = state.geometry[action.id];

        if (!target) {
          return state;
        }

        /* A window is drawn fitted to the desktop, so the drag starts from the drawn rect
         * rather than the stored one. Taking the drawn position holds the far edges still
         * while a window that was cut down to fit is resized. */
        const drawn = constrain(target, state.surface);

        return updateGeometry(state, action.id, {
          x: drawn.x,
          y: drawn.y,
          width: Math.max(layout.minSize.width, action.width),
          height: Math.max(layout.minSize.height, action.height),
        });
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
 * and desktop icons do not re-render with it. */
const ActionsContext = createContext<WindowActions | null>(null);
const ContentContext = createContext<WindowRecord<WindowContent>>({});
const GeometryContext = createContext<WindowRecord<WindowGeometry>>({});
const OrderContext = createContext<Array<WindowId>>([]);
const FocusContext = createContext<WindowId | null>(null);
const SurfaceContext = createContext<Size>(EMPTY_STATE.surface);

function openAction(requestedRoute: string): Action | null {
  const route = windowRouteFor(requestedRoute);
  const target = resolveWindow(route);

  if (!target) {
    return null;
  }

  return { type: "open", id: target.id, route, title: target.title };
}

function initialState(reducer: WindowReducer, pathname: string): ManagerState {
  const action = openAction(pathname);
  return action ? reducer(EMPTY_STATE, action) : EMPTY_STATE;
}

export function WindowManagerProvider({
  layout,
  initialRoute,
  children,
}: {
  layout: WindowLayout;
  initialRoute?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const navigate = useNavigate();
  const reducer = useMemo(() => createWindowReducer(layout), [layout]);
  const [state, dispatch] = useReducer(reducer, router, (initialRouter) =>
    initialState(reducer, initialRouter.state.location.pathname),
  );
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const actions = useMemo<WindowActions>(() => {
    const open: WindowActions["open"] = (route) => {
      const action = openAction(route);

      if (action) {
        dispatch(action);
      }
    };

    return {
      open,
      close: (id) => dispatch({ type: "close", id }),
      focus: (id) => dispatch({ type: "focus", id }),
      move: (id, x, y) => dispatch({ type: "move", id, x, y }),
      resize: (id, width, height) => dispatch({ type: "resize", id, width, height }),
      toggleZoom: (id) => dispatch({ type: "zoom", id }),
      measure: (surface) => dispatch({ type: "measure", surface }),
      organize: () => dispatch({ type: "organize" }),
      focusDesktop: () => dispatch({ type: "focusDesktop" }),
    };
  }, [dispatch]);

  /* The two effects below keep the focused window and the URL in sync. expectedRouteRef
   * records internal navigation so the URL→focus effect can ignore it and act only
   * on external URL changes (deep links, back, forward, etc.). */
  const expectedRouteRef = useRef<string | null>(null);

  /* True while the desktop opens a window that the visitor did not ask for, so the
   * sync below replaces "/" instead of pushing over it. Every other sync follows a
   * real interaction so Back moves between windows normally. */
  const isAutomaticFocusRef = useRef(false);

  const syncUrlToFocus = useEffectEvent((focusedRoute: string | null) => {
    const route = focusedRoute ?? "/";
    const isAutomaticFocus = isAutomaticFocusRef.current;

    isAutomaticFocusRef.current = false; // Cleared on every path, so a sync that does not navigate cannot leave it set for the next one.

    if (pathname === route) {
      return;
    }

    /* A push would leave an entry that reopens or redirects as soon as Back reached it
     * (browsers detect this and mark the entry skippable), so the URL is replaced
     * whenever it is only being corrected: the desktop opened the window on its own, or
     * the current URL is the one the open window came from (a collection index). */
    const isCorrection = isAutomaticFocus || windowRouteFor(pathname) === route;

    expectedRouteRef.current = route;
    void navigate({ to: route, replace: isCorrection });
  });

  const focusedRoute = state.focused === null ? null : (state.content[state.focused]?.route ?? null);

  useEffect(() => {
    syncUrlToFocus(focusedRoute);
  }, [focusedRoute]);

  // An external URL change (deep link, browser back/forward) opens/focuses its window.
  const syncFocusToUrl = useEffectEvent((route: string) => {
    const expectedRoute = expectedRouteRef.current;

    expectedRouteRef.current = null;

    if (route === expectedRoute) {
      return;
    }

    /* "/" is the one route with no window behind it, so it activates the desktop
     * instead of opening something. Without this a step onto "/" would leave the
     * window that was focused before it looking active. */
    if (route === "/") {
      actions.focusDesktop();
      return;
    }

    actions.open(route);
  });

  useEffect(() => {
    syncFocusToUrl(pathname);
  }, [pathname]);

  /* A first visit to the bare desktop opens the default window. A later return
   * to "/" (e.g. via a click on the desktop) does not reopen it. */
  const openInitialWindow = useEffectEvent(() => {
    if (initialRoute && pathname === "/") {
      isAutomaticFocusRef.current = true;
      actions.open(initialRoute);
    }
  });

  useEffect(() => {
    openInitialWindow();
  }, []);

  return (
    <ActionsContext value={actions}>
      <OrderContext value={state.order}>
        <FocusContext value={state.focused}>
          <SurfaceContext value={state.surface}>
            <ContentContext value={state.content}>
              <GeometryContext value={state.geometry}>{children}</GeometryContext>
            </ContentContext>
          </SurfaceContext>
        </FocusContext>
      </OrderContext>
    </ActionsContext>
  );
}

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
