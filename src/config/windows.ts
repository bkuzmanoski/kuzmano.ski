import type { Size } from "#/lib/geometry";
import type { WindowLayout } from "#/lib/window-manager";

const MIN_SIZE: Size = { width: 440, height: 440 }; // Full-width on an iPhone Pro Max in portrait (will be clamped by `padding` below).

export const LAYOUT: WindowLayout = {
  windows: {
    entry: { defaultSize: { width: 1024, height: 1024 }, openAt: "cascade", fixedSize: false },
    collection: { defaultSize: { width: 1024, height: 1024 }, openAt: "cascade", fixedSize: false },
    contact: { defaultSize: { width: 572, height: 480 }, openAt: "center", fixedSize: true },
  },
  minSize: MIN_SIZE,
  cascadeOffset: {
    x: 0,
    y: 29, // The height of the title bar defined in `styles.css` (+1 for the border).
  },
  padding: 12, // Mirrored by `--window-layer-padding` in `styles.css`.
};
