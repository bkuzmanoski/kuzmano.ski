import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from "react";

import {
  ActionsContext,
  ContentContext,
  EMPTY_STATE,
  FocusContext,
  GeometryContext,
  OrderContext,
  SurfaceContext,
  createWindowReducer,
} from "./window-manager";
import { resolveWindow, windowRouteFor } from "./window-registry";

import type { Action, ManagerState, WindowActions, WindowLayout, WindowReducer } from "./window-manager";
import type { ReactNode } from "react";

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
