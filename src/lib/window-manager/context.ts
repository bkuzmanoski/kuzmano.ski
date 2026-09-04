import { createContext, use } from "react";

import { EMPTY_STATE } from "./window.ts";

import type { Size } from "../geometry.ts";
import type { CloseGuard } from "./close-guards.ts";
import type { WindowContent, WindowGeometry, WindowId, WindowRecord } from "./window.ts";

interface OpenOptions {
  replaceUrl?: boolean;
}

interface CloseOptions {
  force?: boolean;
}

export interface WindowActions {
  open: (route: string, options?: OpenOptions) => void;
  close: (id: WindowId, options?: CloseOptions) => void;
  registerCloseGuard: (id: WindowId, guard: CloseGuard) => () => void;
  focus: (id: WindowId) => void;
  move: (id: WindowId, x: number, y: number) => void;
  resize: (id: WindowId, width: number, height: number) => void;
  toggleZoom: (id: WindowId) => void;
  measure: (surface: Size) => void;
  cycleWindows: () => void;
  focusDesktop: () => void;
  showNotFound: (route: string) => void;
  dismissNotFound: () => void;
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

export function useWindowContent(): WindowRecord<WindowContent> {
  return use(ContentContext);
}

export function useWindowGeometry(): WindowRecord<WindowGeometry> {
  return use(GeometryContext);
}

export function useWindowOrder(): Array<WindowId> {
  return use(OrderContext);
}

export function useFocusedWindow(): WindowId | null {
  return use(FocusContext);
}

/** The measured size of the desktop surface, or {0, 0} prior to the first measurement. */
export function useSurface(): Size {
  return use(SurfaceContext);
}

/** The route the desktop is reporting as missing, or `null` when the desktop is not showing a not-found route. */
export function useNotFoundRoute(): string | null {
  return use(NotFoundContext);
}
