import type { WindowLayout } from "#/lib/window-manager";

export const WINDOW_LAYOUT: WindowLayout = {
  defaultSize: { width: 720, height: 560 },
  minSize: { width: 480, height: 280 },
  cascadeOffset: 28, // Height of the title bar.
};
