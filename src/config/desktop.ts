import type { IconLayout } from "#/lib/desktop-icons/icon.ts";
import type { Size } from "#/lib/geometry.ts";
import type { WindowLayout } from "#/lib/window-manager/window.ts";

// An odd window width keeps pane widths even when `--layout-scrollbar-gutter-width` is odd, so full-width dither patterns do not end on a partial column.
const CONTENT_WINDOW_DEFAULT_SIZE = { width: 1201, height: 1200 };

export const WINDOW_SPECS: WindowLayout["windows"] = {
  entry: { defaultSize: CONTENT_WINDOW_DEFAULT_SIZE, fixedSize: false },
  collection: { defaultSize: CONTENT_WINDOW_DEFAULT_SIZE, fixedSize: false },
  contact: { defaultSize: { width: 572, height: 480 }, fixedSize: true },
};
export const WINDOW_MIN_SIZE: Size = { width: 440, height: 440 }; // Full-width on an iPhone Pro Max in portrait (clamped by the window layer padding).
export const ICON_LAYOUT: IconLayout = {
  cellSize: 72,
  position: { top: 24, right: 32 },
  spacing: 96,
};
export const SCREENSAVER_IDLE_DELAY_MS = 3 * 60 * 1000;
