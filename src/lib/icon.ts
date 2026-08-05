import { cycle } from "./math";

export type IconKind = "page" | "collection" | "download";

export type Icon = { id: string; label: string } & (
  { kind: "page" | "collection"; route: string } | { kind: "download"; downloadUrl: string }
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
    // Ignored.
  }

  return positions;
}

export function savePositions(positions: IconPositions, storageKey: string) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(positions));
  } catch {
    // Ignored.
  }
}

export function nextIconId(ids: ReadonlyArray<string>, fromId: string, direction: 1 | -1): string {
  return ids[cycle(ids.length, ids.indexOf(fromId), direction)]!;
}
