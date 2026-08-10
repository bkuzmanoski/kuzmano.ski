import { useSyncExternalStore } from "react";

import { loadPositions, savePositions } from "./icon";
import { createEmitter } from "./store";

import type { IconLayout, IconPosition, IconPositions } from "./icon";

/* Positions live in the store instead of component state for two reasons.
 *
 * 1. Drags write here synchronously, so by the time a drag ends the final
 *    position is already persisted. Component state wouldn't be reliable
 *    here, since it would still be waiting on its next commit.
 * 2. `getServerSnapshot` returns null, which we treat as "not loaded yet".
 *    That means both the server render and the hydration pass render no
 *    icons. A position is meaningless before the layer has been measured
 *    on the client. Once hydration finishes, React re-renders with the real
 *    positions, so a mount effect isn't needed just to read from storage. */
export function createIconPositionsStore(ids: ReadonlyArray<string>, layout: IconLayout, storageKey: string) {
  let positions: IconPositions = {};
  let hasLoaded = false;

  const { emit, subscribe } = createEmitter();

  function getSnapshot(): IconPositions | null {
    if (!hasLoaded) {
      positions = loadPositions(ids, layout, storageKey);
      hasLoaded = true;
    }

    return positions;
  }

  const getServerSnapshot = (): IconPositions | null => null;

  /** The icon positions, or null before the client has read them. */
  function useIconPositions(): IconPositions | null {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  /** Moves one icon. Call `commitIconPositions` when the drag ends to persist the layout. */
  function moveIcon(id: string, position: IconPosition) {
    positions = { ...positions, [id]: position };
    emit();
  }

  function commitIconPositions() {
    savePositions(positions, storageKey);
  }

  return { useIconPositions, moveIcon, commitIconPositions };
}
