import { createContext, use } from "react";

import { getPrefersReducedMotion } from "../hooks/use-prefers-reduced-motion.ts";

import { useWindowContent } from "./context.ts";

import type { Rect } from "../geometry.ts";
import type { WindowId } from "./window.ts";

/** A zoom rect growing from `from`, in viewport coordinates, toward the window `windowId`. */
export interface ZoomRectRequest {
  windowId: WindowId;
  from: Rect;
}

export const ZoomRectContext = createContext<((request: ZoomRectRequest) => void) | null>(null);

/**
 * Returns `zoomFrom`, which animates a zoom rect from `element` to an unopened window. The animation is skipped when
 * reduced motion is preferred or the window is already open. Call `zoomFrom` during the same event that opens it.
 */
export function useZoomRect() {
  const showZoomRect = use(ZoomRectContext);
  const content = useWindowContent();

  return function zoomFrom(element: Element, windowId: WindowId) {
    if (content[windowId] || getPrefersReducedMotion()) {
      return;
    }

    showZoomRect?.({ windowId, from: element.getBoundingClientRect() });
  };
}
