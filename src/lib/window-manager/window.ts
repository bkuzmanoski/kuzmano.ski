import type { Position, Rect, Size } from "../geometry";

export const WINDOW_DOM_ORDER = ["collection", "entry", "contact"] as const;

export type WindowId = (typeof WINDOW_DOM_ORDER)[number];

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

export interface WindowSpec {
  defaultSize: Size;
  openAt: "cascade" | "center";
  fixedSize: boolean;
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
  | { type: "zoom"; id: WindowId }
  | { type: "measure"; surface: Size }
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

export function isUnmeasured(surface: Size): boolean {
  return surface.width === 0 || surface.height === 0;
}
