import type { IconLayout } from "#/lib/desktop-icons/icon.ts";
import type { WindowLayout } from "#/lib/window-manager/window.ts";

/** The site's windows, in the order the window layer renders them. */
export const WINDOW_DOM_ORDER = ["collection", "entry", "contact", "controlPanel"] as const;

declare module "#/lib/window-manager/window.ts" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Declaration merging adds the members it extends.
  interface WindowIdRegistry extends Record<(typeof WINDOW_DOM_ORDER)[number], true> {}
}

export const WINDOW_LAYOUT: WindowLayout = {
  windows: {
    // Odd widths keep pane widths even when `--layout-scrollbar-gutter-width` is odd, so full-width dither patterns do
    // not end on a partial column.
    entry: { defaultSize: { width: 1281, height: 1280 }, sizing: "resizable" },
    collection: { defaultSize: { width: 641, height: 655 }, sizing: "resizable" }, // Height fits 18 rows exactly.

    contact: { defaultSize: { width: 572, height: 480 }, sizing: "fixed" },
    controlPanel: { defaultSize: { width: 480, height: 273 }, sizing: "fitContentHeight" },
  },
  minSize: { width: 440, height: 440 }, // Full-width on an iPhone Pro Max in portrait (clamped by the window layer padding).
  padding: 12, // Window placement keeps a window this far from each edge of the window layer.
};
export const ICON_LAYOUT: IconLayout = {
  cellSize: 72,
  position: { top: 24, right: 32 },
  spacing: 96,
};
export const SCREENSAVER_IDLE_DELAY_MS = 3 * 60 * 1000;
