import { useSyncExternalStore } from "react";

import { ICON_IDS, ICON_LAYOUT } from "#/config/icons";

import { cycle } from "./math";

export type IconKind = "app" | "folder" | "document";

export type Icon = { id: string; label: string } & (
  { kind: "app" | "folder"; route: string } | { kind: "document"; downloadUrl: string }
);

export interface IconPosition {
  top: number;
  right: number;
}

export type IconPositions = Record<string, IconPosition>;

export interface IconLayout {
  cellSize: number;
  spacing: number;
  position: IconPosition;
}

export const ICON_POSITIONS_STORAGE_KEY = "icon-positions";

function defaultPositions(ids: ReadonlyArray<string>, layout: IconLayout): IconPositions {
  const positions: IconPositions = {};

  ids.forEach((id, index) => {
    positions[id] = { right: layout.position.right, top: layout.position.top + index * layout.spacing };
  });

  return positions;
}

export function isValidPosition(value: unknown): value is IconPosition {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isFinite((value as IconPosition).right) &&
    Number.isFinite((value as IconPosition).top)
  );
}

/** Every icon gets a finite position: the saved one when it is valid, the default otherwise. */
export function loadPositions(ids: ReadonlyArray<string>, layout: IconLayout, storageKey: string): IconPositions {
  const positions = defaultPositions(ids, layout);

  try {
    const rawValue = localStorage.getItem(storageKey);

    if (rawValue) {
      const saved = JSON.parse(rawValue) as Record<string, unknown>;

      for (const id of ids) {
        const value = saved[id];

        if (isValidPosition(value)) {
          positions[id] = { right: value.right, top: value.top };
        }
      }
    }
  } catch {
    /* Ignored. */
  }

  return positions;
}

export function savePositions(positions: IconPositions, storageKey: string) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(positions));
  } catch {
    /* Ignored. */
  }
}

export function nextIconId(ids: ReadonlyArray<string>, fromId: string, direction: 1 | -1): string {
  return ids[cycle(ids.length, ids.indexOf(fromId), direction)]!;
}

/*
 * Positions are stored in this module instead of component state for two reasons.
 *
 * 1. Drags write here synchronously, so by the time a drag ends the final
 *    position is already persisted. Component state wouldn't be reliable
 *    here, since it would still be waiting on its next commit.
 *
 * 2. `getServerSnapshot` returns null, which we treat as "not loaded yet".
 *    That means both the server render and the hydration pass render no
 *    icons. A position is meaningless before the layer has been measured
 *    on the client. Once hydration finishes, React re-renders with the real
 *    positions, so a mount effect isn't needed just to read from storage.
 */
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
