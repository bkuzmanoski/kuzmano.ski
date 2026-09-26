import type { IconLayout } from "#/lib/desktop-icons/icon.ts";
import type { Size } from "#/lib/geometry.ts";
import type { WindowLayout } from "#/lib/window-manager/window.ts";

export const WINDOW_SPECS: WindowLayout["windows"] = {
  entry: { defaultSize: { width: 1024, height: 1024 }, fixedSize: false },
  collection: { defaultSize: { width: 1024, height: 1024 }, fixedSize: false },
  contact: { defaultSize: { width: 572, height: 480 }, fixedSize: true },
};
export const WINDOW_MIN_SIZE: Size = { width: 440, height: 440 }; // Full-width on an iPhone Pro Max in portrait (clamped by the window layer padding).
export const ICON_LAYOUT: IconLayout = {
  cellSize: 72,
  position: { top: 24, right: 32 },
  spacing: 96,
};
export const SCREENSAVER_IDLE_DELAY_MS = 3 * 60 * 1000;
