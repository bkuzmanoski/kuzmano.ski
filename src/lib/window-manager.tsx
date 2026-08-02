import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { createContext, use, useEffect, useEffectEvent, useMemo, useReducer, useRef } from "react";

import { resolveWindow, windowKindFor } from "./window-registry";

import type { Position, Rect, Size } from "./geometry";
import type { WindowKind } from "./window-registry";
import type { ReactNode } from "react";

export interface WindowState extends Rect {
  title: string;
  kind: WindowKind;
  maximized: boolean;
}

export interface WindowLayout {
  defaultPosition: Record<WindowKind, Position>;
  defaultSize: Record<WindowKind, Size>;
  minSize: Size;
  cascadeOffset: number;
  maxCascadeSteps: number;
}

export interface ManagerState {
  windows: Record<string, WindowState>;
  order: Array<string>;
  focused: string | null; // `null` means the desktop has focus.
}

export type Action =
  | { type: "open"; route: string; title: string; kind: WindowKind }
  | { type: "close"; route: string }
  | { type: "focus"; route: string }
  | { type: "move"; route: string; x: number; y: number }
  | { type: "resize"; route: string; width: number; height: number }
  | { type: "zoom"; route: string }
  | { type: "organize" }
  | { type: "focusDesktop" };

export const EMPTY_STATE: ManagerState = { windows: {}, order: [], focused: null };

function focusWindow(state: ManagerState, route: string): ManagerState {
  if (!state.windows[route]) {
    return state;
  }

  if (state.focused === route && state.order.at(-1) === route) {
    return state;
  }

  return { ...state, order: [...state.order.filter((open) => open !== route), route], focused: route };
}

function updateWindow(state: ManagerState, route: string, patch: Partial<WindowState>): ManagerState {
  const target = state.windows[route];

  if (!target) {
    return state;
  }

  return { ...state, windows: { ...state.windows, [route]: { ...target, ...patch } } };
}

/** The position of cascade slot `step` for a kind. Slot 0 is the base position. */
function cascadeSlot(layout: WindowLayout, kind: WindowKind, step: number): Position {
  const base = layout.defaultPosition[kind];
  const offset = (step % layout.maxCascadeSteps) * layout.cascadeOffset;

  return { x: base.x + offset, y: base.y + offset };
}

/**
 * The first cascade slot not occupied by an open window. The walk stops at `maxCascadeSteps`
 * and starts the cascade over, so a long session does not march a window off the desktop;
 * the window layer fits the result to the viewport at render time.
 */
function availableCascadeSlot(layout: WindowLayout, windows: Record<string, WindowState>, kind: WindowKind): Position {
  const openWindows = Object.values(windows);

  for (let step = 0; step < layout.maxCascadeSteps; step++) {
    const position = cascadeSlot(layout, kind, step);

    if (!openWindows.some((window) => window.x === position.x && window.y === position.y)) {
      return position;
    }
  }

  return cascadeSlot(layout, kind, 0);
}

export type WindowReducer = (state: ManagerState, action: Action) => ManagerState;

/** Exported for unit tests; the app dispatches through the provider. */
export function createWindowReducer(layout: WindowLayout): WindowReducer {
  return function reducer(state: ManagerState, action: Action): ManagerState {
    switch (action.type) {
      case "open": {
        if (state.windows[action.route]) {
          return focusWindow(state, action.route);
        }

        return {
          windows: {
            ...state.windows,
            [action.route]: {
              title: action.title,
              kind: action.kind,
              maximized: false,
              ...availableCascadeSlot(layout, state.windows, action.kind),
              ...layout.defaultSize[action.kind],
            },
          },
          order: [...state.order, action.route],
          focused: action.route,
        };
      }
      case "close": {
        if (!state.windows[action.route]) {
          return state;
        }

        const { [action.route]: _closed, ...windows } = state.windows;
        const order = state.order.filter((open) => open !== action.route);
        const focused = state.focused === action.route ? (order.at(-1) ?? null) : state.focused;

        return { windows, order, focused };
      }
      case "focus": {
        return focusWindow(state, action.route);
      }
      case "move": {
        return updateWindow(state, action.route, { x: action.x, y: action.y });
      }
      case "resize": {
        /* The stored size is the desired size, never below the minimum.
         * The window layer fits it to the viewport at render time. */
        return updateWindow(state, action.route, {
          width: Math.max(layout.minSize.width, action.width),
          height: Math.max(layout.minSize.height, action.height),
        });
      }
      case "zoom": {
        const target = state.windows[action.route];

        if (!target) {
          return state;
        }

        return updateWindow(focusWindow(state, action.route), action.route, { maximized: !target.maximized });
      }
      case "organize": {
        /* Collections go to the back and content windows to the front, so an open
         * document sits above the folder it came from. Each group then cascades
         * from its own base position, in the stack order it already had. */
        const group = (kind: WindowKind) =>
          state.order.flatMap((route) => {
            const target = state.windows[route];
            return target?.kind === kind ? [[route, target] as const] : [];
          });

        const entries = [...group("collection"), ...group("content")];
        const windows: Record<string, WindowState> = {};
        const steps: Record<WindowKind, number> = { collection: 0, content: 0 };

        for (const [route, target] of entries) {
          windows[route] = {
            ...target,
            ...cascadeSlot(layout, target.kind, steps[target.kind]++),
            maximized: false,
          };
        }

        const order = entries.map(([route]) => route);
        const focused = state.focused === null ? null : (order.at(-1) ?? null);

        return { windows, order, focused };
      }
      case "focusDesktop": {
        return state.focused === null ? state : { ...state, focused: null };
      }
    }
  };
}

export interface WindowActions {
  open: (route: string) => void;
  close: (route: string) => void;
  focus: (route: string) => void;
  move: (route: string, x: number, y: number) => void;
  resize: (route: string, width: number, height: number) => void;
  toggleZoom: (route: string) => void;
  organize: () => void;
  focusDesktop: () => void;
}

/* The state is split across four contexts so a change reaches only the parts
 * that use it. A window drag rewrites `windows` many times per second; keeping
 * the order and the focus apart means the menu bar, the status items, the
 * desktop icons and the open lists do not re-render with it. */
const ActionsContext = createContext<WindowActions | null>(null);
const WindowsContext = createContext<Record<string, WindowState>>({});
const OrderContext = createContext<Array<string>>([]);
const FocusContext = createContext<string | null>(null);

function initialState(reducer: WindowReducer, pathname: string): ManagerState {
  const action = openAction(pathname);
  return action ? reducer(EMPTY_STATE, action) : EMPTY_STATE;
}

function openAction(route: string): Action | null {
  const windowTarget = resolveWindow(route);

  if (!windowTarget) {
    return null;
  }

  return { type: "open", route, title: windowTarget.title, kind: windowKindFor(windowTarget) };
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
      close: (route) => dispatch({ type: "close", route }),
      focus: (route) => dispatch({ type: "focus", route }),
      move: (route, x, y) => dispatch({ type: "move", route, x, y }),
      resize: (route, width, height) => dispatch({ type: "resize", route, width, height }),
      toggleZoom: (route) => dispatch({ type: "zoom", route }),
      organize: () => dispatch({ type: "organize" }),
      focusDesktop: () => dispatch({ type: "focusDesktop" }),
    };
  }, [dispatch]);

  /* The two effects below keep the focused window and the URL in sync. expectedRouteRef
   * records internal navigation so the URL→window effect can ignore it and act only
   * on external URL changes (deep links, back, etc.). */
  const expectedRouteRef = useRef<string | null>(null);

  const syncUrlToFocus = useEffectEvent((focusedRoute: string | null) => {
    if (focusedRoute) {
      if (pathname !== focusedRoute) {
        expectedRouteRef.current = focusedRoute;
        void navigate({ to: focusedRoute });
      }

      return;
    }

    if (pathname !== "/" && resolveWindow(pathname) !== null) {
      expectedRouteRef.current = "/";
      void navigate({ to: "/" });
    }
  });

  const focusedRoute = state.focused;

  useEffect(() => {
    syncUrlToFocus(focusedRoute);
  }, [focusedRoute]);

  // An external URL change (deep link, browser back) opens/focuses its window.
  const openExternalRoute = useEffectEvent((route: string) => {
    const expectedRoute = expectedRouteRef.current;

    expectedRouteRef.current = null;

    if (route === expectedRoute || route === "/") {
      return;
    }

    actions.open(route);
  });

  useEffect(() => {
    openExternalRoute(pathname);
  }, [pathname]);

  /* A first visit to the bare desktop opens the default window. A later return
   * to "/" (e.g. via a click on the desktop) does not reopen it. */
  const openInitialWindow = useEffectEvent(() => {
    if (initialRoute && pathname === "/") {
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
          <WindowsContext value={state.windows}>{children}</WindowsContext>
        </FocusContext>
      </OrderContext>
    </ActionsContext>
  );
}

export function useWindowActions(): WindowActions {
  const actions = use(ActionsContext);

  if (!actions) {
    throw new Error("`useWindowActions` must be used within a `WindowManagerProvider`");
  }

  return actions;
}

/** Every open window, keyed by route. Changes on every move and resize. */
export function useWindows(): Record<string, WindowState> {
  return use(WindowsContext);
}

/** The open windows, back to front. Changes when a window opens, closes, or is raised. */
export function useWindowOrder(): Array<string> {
  return use(OrderContext);
}

/** The active window, or null when the desktop is active. */
export function useFocusedWindow(): string | null {
  return use(FocusContext);
}
