import type { WindowLayout } from "#/lib/window-manager";

export const LAYOUT: WindowLayout = {
  defaultSize: {
    entry: { width: 1024, height: 1024 },
    collection: { width: 1024, height: 1024 },
    notFound: { width: 480, height: 420 },
  },
  minSize: { width: 320, height: 320 },
  openAt: {
    entry: "cascade",
    collection: "cascade",
    notFound: "centre",
  },
  cascadeOffset: { x: 24, y: 29 }, // y = Height of the title bar defined in `window.module.css` (+1 for the border).
  padding: 12, // Mirrored by `--window-layer-padding` in `styles.css`.
};
