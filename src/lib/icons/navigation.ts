import type { IconPlacement } from "./icon";
import type { ArrowKey } from "../keys";

const OFF_AXIS_DISTANCE_WEIGHT = 2; // How much further an icon off the arrow's axis has to be before it loses to one on that axis during keyboard navigation.

/**
 * The icon an arrow key selects, or null when no icon lies in that direction.
 * Candidates are the icons in the half-plane the arrow points at. Distance off
 * the arrow's axis is weighted over distance along it.
 */
export function adjacentIconId(placements: ReadonlyArray<IconPlacement>, fromId: string, key: ArrowKey): string | null {
  const from = placements.find((placement) => placement.id === fromId);

  if (!from) {
    return null;
  }

  const isVertical = key === "ArrowUp" || key === "ArrowDown";
  const sign = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;

  let bestId: string | null = null;
  let bestScore = Infinity;

  for (const placement of placements) {
    if (placement.id === fromId) {
      continue;
    }

    const alongAxisDistance = sign * (isVertical ? placement.y - from.y : placement.x - from.x);
    const offAxisDistance = Math.abs(isVertical ? placement.x - from.x : placement.y - from.y);
    const score = alongAxisDistance + offAxisDistance * OFF_AXIS_DISTANCE_WEIGHT;

    if (alongAxisDistance > 0 && score < bestScore) {
      bestId = placement.id;
      bestScore = score;
    }
  }

  return bestId;
}
