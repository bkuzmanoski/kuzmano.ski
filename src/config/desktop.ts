import type { IconLayout } from "#/lib/desktop-icons/icon.ts";
import type { WindowLayout } from "#/lib/window-manager/window.ts";

export const WINDOW_LAYOUT: WindowLayout = {
  windows: {
    // Odd widths keep pane widths even when `--layout-scrollbar-gutter-width` is odd, so full-width dither patterns do
    // not end on a partial column.
    entry: { defaultSize: { width: 1201, height: 1200 }, sizing: "resizable" },
    collection: { defaultSize: { width: 641, height: 480 }, sizing: "resizable" },

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
