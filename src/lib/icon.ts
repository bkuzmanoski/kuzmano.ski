export type IconKind = "app" | "folder" | "document";

export type Icon = { id: string; label: string } & (
  { kind: "app" | "folder"; route: string } | { kind: "document"; downloadUrl: string }
);

export interface IconPosition {
  top: number;
  right: number;
}

export interface IconLayout {
  cellSize: number;
  spacing: number;
  position: IconPosition;
}

function defaultPositions(ids: ReadonlyArray<string>, layout: IconLayout): Record<string, IconPosition> {
  const positions: Record<string, IconPosition> = {};

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

export function loadPositions(
  ids: ReadonlyArray<string>,
  layout: IconLayout,
  storageKey: Readonly<string>,
): Record<string, IconPosition> {
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

export function savePositions(positions: Record<string, IconPosition>, storageKey: Readonly<string>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(positions));
  } catch {
    /* Ignored. */
  }
}

export function nextIconId(ids: ReadonlyArray<string>, fromId: string, direction: 1 | -1): string {
  const index = ids.indexOf(fromId);

  return ids[(index + direction + ids.length) % ids.length]!;
}
