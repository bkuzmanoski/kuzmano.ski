import type { WindowLayout } from "#/lib/window-manager";

export const LAYOUT: WindowLayout = {
  windows: {
    entry: { defaultSize: { width: 1024, height: 1024 }, openAt: "cascade", fixedSize: false },
    collection: { defaultSize: { width: 1024, height: 1024 }, openAt: "cascade", fixedSize: false },
    notFound: { defaultSize: { width: 480, height: 420 }, openAt: "centre", fixedSize: true },
  },
  minSize: { width: 320, height: 320 },
  cascadeOffset: { x: 24, y: 29 }, // y = Height of the title bar defined in `window.module.css` (+1 for the border).
  padding: 12, // Mirrored by `--window-layer-padding` in `styles.css`.
};
