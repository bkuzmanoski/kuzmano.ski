import { useRef } from "react";

import { swallowNextPress } from "#/lib/press/press.ts";
import type { DragDelta } from "#/lib/press/use-pointer-drag.ts";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/press/use-pointer-drag.ts";

/** The horizontal travel past which a touch drag across an image shows the next or previous image. */
export const SWIPE_DISTANCE_PX = 32;

/**
 * Calls `onSwipe` with `1` when a touch drag moves toward the line's start (next image) or `-1` when it moves toward
 * the end. Ignores a predominantly vertical drag so the browser can scroll the page. Suppresses the swipe's subsequent
 * press to prevent it from opening the preview.
 */
export function useImageGallerySwipe(onSwipe: (direction: 1 | -1) => void) {
  const swipeDeltaRef = useRef<DragDelta | null>(null);
  return usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    canStart: (event) => event.pointerType === "touch",
    start: () => {
      swipeDeltaRef.current = null;
    },
    onDragMove: (delta) => {
      swipeDeltaRef.current = delta;
    },
    onEnd: () => {
      const delta = swipeDeltaRef.current;

      if (delta && Math.abs(delta.dx) >= SWIPE_DISTANCE_PX && Math.abs(delta.dx) > Math.abs(delta.dy)) {
        swallowNextPress();
        onSwipe(delta.dx < 0 ? 1 : -1);
      }
    },
  });
}
