import { readStoredJson, writeStored } from "../storage";

import type { Position } from "../geometry";

export type IconKind = "page" | "collection" | "download";

export type Icon = { id: string; label: string } & (
  { kind: "page" | "collection"; route: string } | { kind: "download"; downloadUrl: string }
);

/** Anchored to the right edge so it adapts to the width of the desktop. */
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

export interface IconPlacement extends Position {
  id: string;
}

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
  const savedPositions = readStoredJson(storageKey) as Record<string, unknown> | null;

  if (savedPositions) {
    for (const id of ids) {
      const value = savedPositions[id];

      if (isValidPosition(value)) {
        positions[id] = { right: value.right, top: value.top };
      }
    }
  }

  return positions;
}

export function savePositions(positions: IconPositions, storageKey: string) {
  writeStored(storageKey, JSON.stringify(positions));
}
