import type { WindowLayout } from "#/lib/window-manager";

export const WINDOW_LAYOUT: WindowLayout = {
  defaultSize: { width: 1024, height: 1024 },
  minSize: { width: 320, height: 320 },
  cascadeOffset: 28, // Height of the title bar defined in `styles.css`.
  padding: 8, // Mirrored by `--window-layer-padding` in `styles.css`.
};
