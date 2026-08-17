import { clampToContainer } from "../geometry";

import type { Position, Size } from "../geometry";
import type { IconLayout, IconPlacement, IconPosition, IconPositions } from "./icon";

/** Whether two cells of `cellSize` positioned at these origins share any area. */
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

/**
 * The first slot on the default grid that nothing already placed covers, or null when the
 * container has none free. Slots run down from the layout's origin and then leftwards, so
 * icons that overflow start a new column beside the ones that stayed.
 */
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

/**
 * Where each icon is placed for a container of this size, in `ids` order. Stored positions are
 * never touched, so growing the container puts every icon back where it was left.
 *
 * A position is anchored to the container's right edge, which means a resize slides every icon
 * by the same amount and cannot change how they sit relative to each other. Icons only ever
 * collide once one of them leaves the container, so the ones that still fit stay exactly where
 * they are. Only the icons that are pushed out are given a new home.
 */
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

  // A container that has not been measured yet has no room to reason about.
  if (container.width === 0 || container.height === 0) {
    return projected;
  }

  const fits = projected.map((placement) => fitsInContainer(placement, container, layout.cellSize));
  const placed: Array<Position> = projected.filter((_, index) => fits[index]).map(({ x, y }) => ({ x, y }));

  return projected.map((placement, index) => {
    if (fits[index]) {
      return placement;
    }

    // Falling back to the clamp keeps an icon on screen when the container is too small to hold
    // the whole set. That is the one case where icons can still land on top of each other.
    const slot = freeSlot(placed, container, layout) ?? {
      x: clampToContainer(placement.x, container.width, layout.cellSize),
      y: clampToContainer(placement.y, container.height, layout.cellSize),
    };

    placed.push(slot);

    return { id: placement.id, ...slot };
  });
}

/**
 * The position stored for an icon dropped at `point`, the inverse of the projection above.
 *
 * The drop is held inside the container so that a drag past an edge sticks to it. Storing a
 * position that lies outside would read as an icon pushed out by a resize, and the icon would
 * be moved to a free slot part way through the drag.
 */
export function positionFromDrop(point: Position, container: Size, layout: IconLayout): IconPosition {
  const x = clampToContainer(point.x, container.width, layout.cellSize);
  return {
    right: container.width - x - layout.cellSize,
    top: clampToContainer(point.y, container.height, layout.cellSize),
  };
}
