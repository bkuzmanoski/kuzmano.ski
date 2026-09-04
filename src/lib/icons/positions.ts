import { createClientStore } from "../client-store.ts";

import { loadPositions, savePositions } from "./icon.ts";

import type { IconLayout, IconPosition, IconPositions } from "./icon.ts";

export const ICON_POSITIONS_STORAGE_KEY = "icon-positions";

export function createIconPositionsStore(ids: ReadonlyArray<string>, layout: IconLayout) {
  const { useValue, getValue, setValue } = createClientStore<IconPositions | null>(null, () =>
    loadPositions(ids, layout, ICON_POSITIONS_STORAGE_KEY),
  );
  return {
    useIconPositions: useValue, // Null before the client has read them.
    moveIcon: (id: string, position: IconPosition) => setValue({ ...getValue(), [id]: position }), // Call `commitIconPositions` when the drag ends to persist the layout.
    commitIconPositions: () => savePositions(getValue() ?? {}, ICON_POSITIONS_STORAGE_KEY),
  };
}
