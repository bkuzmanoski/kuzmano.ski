import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from "react";

import { createCloseGuards } from "#/lib/window-manager/close-guards";
import type { CloseGuards } from "#/lib/window-manager/close-guards";
import {
  ActionsContext,
  ContentContext,
  FocusContext,
  GeometryContext,
  NotFoundContext,
  OrderContext,
  SurfaceContext,
} from "#/lib/window-manager/context";
import type { WindowActions } from "#/lib/window-manager/context";
import { createWindowReducer } from "#/lib/window-manager/state";
import type { WindowReducer } from "#/lib/window-manager/state";
import { EMPTY_STATE } from "#/lib/window-manager/window";
import type { Action, ManagerState, WindowLayout } from "#/lib/window-manager/window";
import { resolveRoute } from "#/site/windows";

import type { ReactNode } from "react";

function openAction(route: string): Action | null {
  const resolvedRoute = resolveRoute(route);

  if (resolvedRoute.id === "desktop" || resolvedRoute.id === "notFound") {
    return null;
  }

  return { type: "open", id: resolvedRoute.id, route, title: resolvedRoute.title };
}

function initialState(reducer: WindowReducer, pathname: string): ManagerState {
  if (resolveRoute(pathname).id === "notFound") {
    return reducer(EMPTY_STATE, { type: "notFound", route: pathname });
  }

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
  const [closeGuards] = useState<CloseGuards>(createCloseGuards);
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
      close: (id, { force = false } = {}) => {
        if (!force && closeGuards.claim(id)) {
          return;
        }

        dispatch({ type: "close", id });
      },
      registerCloseGuard: (id, guard) => closeGuards.register(id, guard),
      focus: (id) => dispatch({ type: "focus", id }),
      move: (id, x, y) => dispatch({ type: "move", id, x, y }),
      resize: (id, width, height) => dispatch({ type: "resize", id, width, height }),
      toggleZoom: (id) => dispatch({ type: "zoom", id }),
      measure: (surface) => dispatch({ type: "measure", surface }),
      cycleWindows: () => dispatch({ type: "cycleWindows" }),
      focusDesktop: () => dispatch({ type: "focusDesktop" }),
      showNotFound: (route) => dispatch({ type: "notFound", route }),
      dismissNotFound: () => dispatch({ type: "dismissNotFound" }),
    };
  }, [closeGuards, dispatch]);

  // The two effects below keep the focused window and the URL in sync. expectedRouteRef
  // records internal navigation so the URL→focus effect can ignore it and act only
  // on external URL changes (deep links, back, forward, etc.).
  const expectedRouteRef = useRef<string | null>(null);

  const syncUrlToFocus = useEffectEvent((focusedRoute: string | null, notFoundRoute: string | null) => {
    if (notFoundRoute !== null) {
      return; // The not-found route owns the URL until its alert is dismissed.
    }

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
    syncUrlToFocus(focusedRoute, state.notFoundRoute);
  }, [focusedRoute, state.notFoundRoute]);

  // An external URL change (deep link, browser back/forward) opens/focuses its window.
  const syncFocusToUrl = useEffectEvent((route: string) => {
    const expectedRoute = expectedRouteRef.current;

    expectedRouteRef.current = null;

    if (route === expectedRoute) {
      return;
    }

    switch (resolveRoute(route).id) {
      case "notFound":
        actions.showNotFound(route);
        break;

      case "desktop":
        actions.focusDesktop();
        break;

      default:
        actions.open(route);
    }
  });

  useEffect(() => {
    syncFocusToUrl(pathname);
  }, [pathname]);

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
      <ContentContext value={state.content}>
        <GeometryContext value={state.geometry}>
          <OrderContext value={state.order}>
            <FocusContext value={state.focused}>
              <SurfaceContext value={state.surface}>
                <NotFoundContext value={state.notFoundRoute}>{children}</NotFoundContext>
              </SurfaceContext>
            </FocusContext>
          </OrderContext>
        </GeometryContext>
      </ContentContext>
    </ActionsContext>
  );
}
