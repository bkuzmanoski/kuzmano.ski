import type { Size } from "#/lib/geometry";
import type { WindowLayout } from "#/lib/window-manager";

const MIN_SIZE: Size = { width: 320, height: 188 };

export const LAYOUT: WindowLayout = {
  windows: {
    entry: { defaultSize: { width: 1024, height: 1024 }, openAt: "cascade", fixedSize: false },
    collection: { defaultSize: { width: 1024, height: 1024 }, openAt: "cascade", fixedSize: false },
    contact: { defaultSize: { width: 572, height: 480 }, openAt: "center", fixedSize: true },
  },
  minSize: MIN_SIZE,
  cascadeOffset: {
    x: 21, // The width of the scrollbar defined in `styles.css` (+1 for the border).
    y: 29, // The height of the title bar defined in `window.module.css` (+1 for the border).
  },
  padding: 12, // Mirrored by `--window-layer-padding` in `styles.css`.
};
