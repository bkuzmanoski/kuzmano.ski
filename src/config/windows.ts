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
  cascadeOffset: { x: 24, y: 28 }, // y = Height of the title bar defined in `styles.css`.
  padding: 8, // Mirrored by `--window-layer-padding` in `styles.css`.
};
