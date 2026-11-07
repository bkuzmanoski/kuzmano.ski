import type { Rect, Size } from "../geometry.ts";

/**
 * The windows the window manager can open, keyed by ID. The site declares them by augmenting this interface (see
 * `WINDOW_DOM_ORDER` in `/src/config/desktop.ts`) so the window manager does not depend on which windows exist.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Declaration merging fills it.
export interface WindowIdRegistry {}

export type WindowId = Extract<keyof WindowIdRegistry, string>;

export interface Destination {
  type: WindowId;
  title: string;
  route: string;
}

export type WindowRecord<T> = Partial<Record<WindowId, T>>;

export interface WindowContent {
  route: string;
  title: string;
}

export interface WindowGeometry extends Rect {
  maximized: boolean;
}

export type WindowSizing = "resizable" | "fixed" | "fitContentHeight";

export interface WindowSpec {
  /**
   * The window manager places a `"fitContentHeight"` window by this height until the window reports its content height.
   */
  defaultSize: Size;
  sizing: WindowSizing;
}

export interface WindowLayout {
  windows: Record<WindowId, WindowSpec>;
  minSize: Size;
  padding: number;
}

export interface ManagerState {
  content: WindowRecord<WindowContent>;
  geometry: WindowRecord<WindowGeometry>;
  order: Array<WindowId>;
  focused: WindowId | null;
  surface: Size;
  notFoundRoute: string | null;
}

export type Action =
  | { type: "open"; id: WindowId; route: string; title: string }
  | { type: "close"; id: WindowId }
  | { type: "focus"; id: WindowId }
  | { type: "move"; id: WindowId; x: number; y: number }
  | { type: "resize"; id: WindowId; width: number; height: number }
  | { type: "fitContentHeight"; id: WindowId; height: number }
  | { type: "zoom"; id: WindowId }
  | { type: "measure"; surface: Size }
  | { type: "cycleWindows" }
  | { type: "focusDesktop" }
  | { type: "showNotFoundAlert"; route: string }
  | { type: "dismissNotFoundAlert" };

export const EMPTY_STATE: ManagerState = {
  content: {},
  geometry: {},
  order: [],
  focused: null,
  surface: { width: 0, height: 0 },
  notFoundRoute: null,
};

export function isUnmeasured(surface: Size): boolean {
  return surface.width === 0 || surface.height === 0;
}
