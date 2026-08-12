import { createClientStore } from "../client-store";

import { loadPositions, savePositions } from "./icon";

import type { IconLayout, IconPosition, IconPositions } from "./icon";

export function createIconPositionsStore(ids: ReadonlyArray<string>, layout: IconLayout, storageKey: string) {
  const { useValue, getValue, setValue } = createClientStore<IconPositions | null>(null, () =>
    loadPositions(ids, layout, storageKey),
  );

  return {
    useIconPositions: useValue, // Null before the client has read them.
    moveIcon: (id: string, position: IconPosition) => setValue({ ...getValue(), [id]: position }), // Moves an icon. Call `commitIconPositions` when the drag ends to persist the layout.
    commitIconPositions: () => savePositions(getValue() ?? {}, storageKey),
  };
}
