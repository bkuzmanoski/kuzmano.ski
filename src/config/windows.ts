import { createSidebarWidthStore } from "#/lib/sidebar-width";
import type { SidebarLayout } from "#/lib/sidebar-width";
import type { WindowLayout } from "#/lib/window-manager";

export const WINDOW_LAYOUT: WindowLayout = {
  defaultSize: { width: 1024, height: 1024 },
  minSize: { width: 320, height: 320 },
  cascadeOffset: 28, // Height of the title bar defined in `styles.css`.
  padding: 8, // Mirrored by `--window-layer-padding` in `styles.css`.
};

export const SIDEBAR_LAYOUT: SidebarLayout = {
  defaultWidth: 240,
  minWidth: 208,
  maxWidth: 480,
};

export const SIDEBAR_WIDTH_STORAGE_KEY = "sidebar-width";

export const { useSidebarWidth, setSidebarWidth, commitSidebarWidth, resetSidebarWidth } = createSidebarWidthStore(
  SIDEBAR_LAYOUT,
  SIDEBAR_WIDTH_STORAGE_KEY,
);
