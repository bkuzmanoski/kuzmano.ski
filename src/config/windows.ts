import type { Position, Size } from "#/lib/geometry";
import type { WindowKind } from "#/lib/window-registry";

const MARGIN = 16;

export const CASCADE_OFFSET = 28; // Height of the title bar.
export const MAX_CASCADE_STEPS = 8; // The number of windows cascaded before the next one wraps to the default position.
export const DEFAULT_SIZE: Record<WindowKind, Size> = {
  collection: { width: 480, height: 420 },
  content: { width: 720, height: 640 },
};
export const MIN_SIZE: Size = { width: 280, height: 160 };
export const DEFAULT_POSITION: Record<WindowKind, Position> = {
  collection: { x: MARGIN, y: MARGIN },
  content: { x: MARGIN * 2 + DEFAULT_SIZE.collection.width, y: MARGIN },
};
