import { createClientStore } from "./client-store";
import { clamp } from "./math";
import { readStored, removeStored, writeStored } from "./storage";

export interface SidebarLayout {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

function loadWidth(layout: SidebarLayout, storageKey: string): number {
  const storedWidth = Number(readStored(storageKey));
  return storedWidth > 0 ? clamp(storedWidth, layout.minWidth, layout.maxWidth) : layout.defaultWidth;
}

/* The width lives in a store rather than in the window that draws the sidebar, so that
 * it outlives that window and every window agrees on it. As with the icon positions, a
 * drag writes here on every frame and persists what it left behind when it ends. */
export function createSidebarWidthStore(layout: SidebarLayout, storageKey: string) {
  const { useValue, getValue, setValue } = createClientStore(layout.defaultWidth, () => loadWidth(layout, storageKey));

  return {
    useSidebarWidth: useValue,
    setSidebarWidth: (width: number) => setValue(clamp(width, layout.minWidth, layout.maxWidth)), // Resizes the sidebar. Call `commitSidebarWidth` when the drag ends to persist the width.
    commitSidebarWidth: () => writeStored(storageKey, String(getValue())),
    resetSidebarWidth: () => {
      setValue(layout.defaultWidth);
      removeStored(storageKey);
    },
  };
}
