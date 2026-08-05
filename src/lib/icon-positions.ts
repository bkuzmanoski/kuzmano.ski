import { useSyncExternalStore } from "react";

import { ICON_IDS, ICON_LAYOUT } from "#/config/desktop-icons";

import { loadPositions, savePositions } from "./icon";

import type { IconPosition, IconPositions } from "./icon";

export const ICON_POSITIONS_STORAGE_KEY = "icon-positions";

/* Positions live in this module instead of component state for two reasons.
 *
 * 1. Drags write here synchronously, so by the time a drag ends the final
 *    position is already persisted. Component state wouldn't be reliable
 *    here, since it would still be waiting on its next commit.
 *
 * 2. `getServerSnapshot` returns null, which we treat as "not loaded yet".
 *    That means both the server render and the hydration pass render no
 *    icons. A position is meaningless before the layer has been measured
 *    on the client. Once hydration finishes, React re-renders with the real
 *    positions, so a mount effect isn't needed just to read from storage. */
let positions: IconPositions = {};
let hasLoaded = false;

const listeners = new Set<() => void>();

function getSnapshot(): IconPositions | null {
  if (!hasLoaded) {
    positions = loadPositions(ICON_IDS, ICON_LAYOUT, ICON_POSITIONS_STORAGE_KEY);
    hasLoaded = true;
  }

  return positions;
}

const getServerSnapshot = (): IconPositions | null => null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The icon positions, or null before the client has read them. */
export function useIconPositions(): IconPositions | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Moves one icon. Call `commitIconPositions` when the drag ends to persist the layout. */
export function moveIcon(id: string, position: IconPosition) {
  positions = { ...positions, [id]: position };

  for (const listener of listeners) {
    listener();
  }
}

export function commitIconPositions() {
  savePositions(positions, ICON_POSITIONS_STORAGE_KEY);
}
