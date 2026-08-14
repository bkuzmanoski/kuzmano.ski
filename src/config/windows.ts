import type { Size } from "#/lib/geometry";
import type { WindowId, WindowLayout } from "#/lib/window-manager";

const DEFAULT_SIZE: Record<WindowId, Size> = {
  entry: { width: 1024, height: 1024 },
  collection: { width: 1024, height: 1024 },
  notFound: { width: 480, height: 420 },
};
const MIN_SIZE: Size = { width: 320, height: 320 };

export const LAYOUT: WindowLayout = {
  openAt: {
    entry: "cascade",
    collection: "cascade",
    notFound: "centre",
  },
  defaultSize: DEFAULT_SIZE,
  minSize: MIN_SIZE,
  cascadeOffset: 28, // Height of the title bar defined in `styles.css`.
  padding: 8, // Mirrored by `--window-layer-padding` in `styles.css`.
};
