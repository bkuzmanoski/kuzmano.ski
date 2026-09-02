import { clampToContainer } from "../geometry";

import type { Position, Size } from "../geometry";
import type { IconLayout, IconPlacement, IconPosition, IconPositions } from "./icon";

function overlaps(a: Position, b: Position, cellSize: number): boolean {
  return Math.abs(a.x - b.x) < cellSize && Math.abs(a.y - b.y) < cellSize;
}

function fitsInContainer(position: Position, container: Size, cellSize: number): boolean {
  return (
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + cellSize <= container.width &&
    position.y + cellSize <= container.height
  );
}

function freeSlot(placed: ReadonlyArray<Position>, container: Size, layout: IconLayout): Position | null {
  for (let x = container.width - layout.position.right - layout.cellSize; x >= 0; x -= layout.spacing) {
    for (let y = layout.position.top; y + layout.cellSize <= container.height; y += layout.spacing) {
      const slot = { x, y };

      if (!placed.some((position) => overlaps(position, slot, layout.cellSize))) {
        return slot;
      }
    }
  }

  return null;
}

/** Icon placements for a given container size, in `ids` order. Does not modify stored positions. */
export function resolveIconPlacements(
  ids: ReadonlyArray<string>,
  positions: IconPositions,
  container: Size,
  layout: IconLayout,
): Array<IconPlacement> {
  const projected = ids.flatMap((id) => {
    const position = positions[id];

    return position ? [{ id, x: container.width - position.right - layout.cellSize, y: position.top }] : [];
  });

  if (container.width === 0 || container.height === 0) {
    return projected;
  }

  const fits = projected.map((placement) => fitsInContainer(placement, container, layout.cellSize));
  const placed: Array<Position> = projected.filter((_, index) => fits[index]).map(({ x, y }) => ({ x, y }));

  return projected.map((placement, index) => {
    if (fits[index]) {
      return placement;
    }

    const slot = freeSlot(placed, container, layout) ?? {
      x: clampToContainer(placement.x, container.width, layout.cellSize),
      y: clampToContainer(placement.y, container.height, layout.cellSize),
    };

    placed.push(slot);

    return { id: placement.id, ...slot };
  });
}

/** Returns the stored icon position for `point`, clamped to the container bounds. */
export function positionFromDrop(point: Position, container: Size, layout: IconLayout): IconPosition {
  const x = clampToContainer(point.x, container.width, layout.cellSize);
  return {
    right: container.width - x - layout.cellSize,
    top: clampToContainer(point.y, container.height, layout.cellSize),
  };
}
