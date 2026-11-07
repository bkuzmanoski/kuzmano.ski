import { cycle } from "./math.ts";

export interface ListNavigationOptions {
  wraps: boolean;
  isEnabled?: (index: number) => boolean;
}

const everyItem = () => true;

/** Finds the first or last index accepted by `isEnabled`, or returns `-1` if none are accepted. */
export function edgeIndexOf(edge: "first" | "last", count: number, isEnabled: (index: number) => boolean = everyItem) {
  for (let step = 0; step < count; step++) {
    const index = edge === "first" ? step : count - 1 - step;

    if (isEnabled(index)) {
      return index;
    }
  }

  return -1;
}

/**
 * Finds the nearest enabled item in `direction` from `fromIndex`. When `fromIndex` is `-1`, it returns the first
 * enabled item when moving down or the last when moving up. If no eligible item is found, it returns `fromIndex`.
 */
function adjacentIndexOf(
  fromIndex: number,
  direction: 1 | -1,
  count: number,
  { wraps, isEnabled = everyItem }: ListNavigationOptions,
) {
  if (fromIndex < 0) {
    const edgeIndex = edgeIndexOf(direction === 1 ? "first" : "last", count, isEnabled);
    return edgeIndex < 0 ? fromIndex : edgeIndex;
  }

  let index = fromIndex;

  for (let step = 1; step < count; step++) {
    index = wraps ? cycle(count, index, direction) : index + direction;

    if (index < 0 || index >= count) {
      break;
    }

    if (isEnabled(index)) {
      return index;
    }
  }

  return fromIndex;
}

/**
 * Gets the focus target for a navigation key in a vertical list. `fromIndex` is the currently focused item, or `-1`
 * when none is focused. Arrow keys move to the next enabled item, while Home and End move to the first and last;
 * unsupported keys return `null`.
 */
export function navigationTargetOf(
  key: string,
  fromIndex: number,
  count: number,
  options: ListNavigationOptions,
): number | null {
  switch (key) {
    case "ArrowDown":
      return adjacentIndexOf(fromIndex, 1, count, options);

    case "ArrowUp":
      return adjacentIndexOf(fromIndex, -1, count, options);

    case "Home":
      return edgeIndexOf("first", count, options.isEnabled);

    case "End":
      return edgeIndexOf("last", count, options.isEnabled);

    default:
      return null;
  }
}
