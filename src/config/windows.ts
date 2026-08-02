import type { WindowLayout } from "#/lib/window-manager";

const MARGIN = 16;

const DEFAULT_SIZE: WindowLayout["defaultSize"] = {
  collection: { width: 480, height: 420 },
  content: { width: 720, height: 640 },
};

export const WINDOW_LAYOUT: WindowLayout = {
  defaultPosition: {
    collection: { x: MARGIN, y: MARGIN },
    content: { x: MARGIN * 2 + DEFAULT_SIZE.collection.width, y: MARGIN },
  },
  defaultSize: DEFAULT_SIZE,
  minSize: { width: 280, height: 160 },
  cascadeOffset: 28, // Height of the title bar.
  maxCascadeSteps: 8, // The number of windows cascaded before the next one wraps to the default position.
};
