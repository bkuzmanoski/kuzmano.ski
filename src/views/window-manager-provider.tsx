import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from "react";

import { resolveWindow } from "#/content/window-registry";
import {
  ActionsContext,
  ContentContext,
  EMPTY_STATE,
  FocusContext,
  GeometryContext,
  OrderContext,
  SurfaceContext,
  createWindowReducer,
} from "#/lib/window-manager";
import type { Action, ManagerState, WindowActions, WindowLayout, WindowReducer } from "#/lib/window-manager";

import type { ReactNode } from "react";

function openAction(route: string): Action | null {
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const reducer = useMemo(() => createWindowReducer(layout), [layout]);
  const [state, dispatch] = useReducer(reducer, router, (initialRouter) =>
    initialState(reducer, initialRouter.state.location.pathname),
  );
  const shouldReplaceUrlRef = useRef(false);

  const actions = useMemo<WindowActions>(() => {
    const open: WindowActions["open"] = (route, { replaceUrl = false } = {}) => {
      const action = openAction(route);

      if (action) {
        shouldReplaceUrlRef.current = replaceUrl;
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

  // The two effects below keep the focused window and the URL in sync. expectedRouteRef
  // records internal navigation so the URL→focus effect can ignore it and act only
  // on external URL changes (deep links, back, forward, etc.).
  const expectedRouteRef = useRef<string | null>(null);

  const syncUrlToFocus = useEffectEvent((focusedRoute: string | null) => {
    const route = focusedRoute ?? "/";
    const shouldReplaceUrl = shouldReplaceUrlRef.current;

    shouldReplaceUrlRef.current = false; // Cleared on every path, so a sync that does not navigate cannot leave it set for the next one.

    if (pathname === route) {
      return;
    }

    expectedRouteRef.current = route;

    void navigate({ to: route, replace: shouldReplaceUrl });
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

    // "/" is the one route with no window behind it, so it activates the desktop
    // instead of opening something. Without this a step onto "/" would leave the
    // window that was focused before it looking active.
    if (route === "/") {
      actions.focusDesktop();
      return;
    }

    actions.open(route);
  });

  useEffect(() => {
    syncFocusToUrl(pathname);
  }, [pathname]);

  // A first visit to the bare desktop opens the default window. A later
  // return to "/" (e.g., via a click on the desktop) does not reopen it.
  const openInitialWindow = useEffectEvent(() => {
    if (initialRoute && pathname === "/") {
      actions.open(initialRoute, { replaceUrl: true });
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
