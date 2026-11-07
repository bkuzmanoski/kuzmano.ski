import { useRef, useState } from "react";

import { playClickSound } from "#/lib/audio/sounds.ts";
import { clientPositionOf, containsPoint } from "#/lib/geometry.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { useDoublePress } from "#/lib/press/use-double-press.ts";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/press/use-pointer-drag.ts";

import type { WindowDrag } from "./window.tsx";

export function useWindowDrag({
  x,
  y,
  width,
  height,
  maximized,
  onMove,
  onResize,
  onZoom,
  onDrag,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
  onMove: (x: number, y: number) => void;
  onResize: ((width: number, height: number) => void) | null;
  onZoom: (() => void) | null;
  onDrag: (drag: WindowDrag | null) => void;
}) {
  const [isResizing, setIsResizing] = useState(false);
  const [isResizePressed, setIsResizePressed] = useState(false);
  const hasMovedWindowRef = useRef(false);
  const dragRef = useRef<WindowDrag | null>(null);

  function reportDrag(drag: WindowDrag) {
    dragRef.current = drag;
    onDrag(drag);
  }

  function endDrag() {
    const drag = dragRef.current;

    dragRef.current = null;
    onDrag(null);

    return drag;
  }

  const moveHandlers = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX, // The title bar also responds to a double click, which must survive the jitter of a press.
    canStart: (event) => !maximized && !(event.target as HTMLElement).closest("button"),
    start: () => {
      playClickSound();
      hasMovedWindowRef.current = false;

      return { x, y };
    },
    onDragMove: (delta, from) => reportDrag({ kind: "move", x: from.x + delta.dx, y: from.y + delta.dy }),
    onEnd: (moved) => {
      const drag = endDrag();

      hasMovedWindowRef.current = moved;

      if (drag?.kind === "move") {
        onMove(drag.x, drag.y);
      }
    },
  });
  const zoomHandlers = useDoublePress({
    acceptsDoublePress: (event) =>
      Boolean(onZoom) && !(event.target as HTMLElement).closest("button") && (maximized || !hasMovedWindowRef.current),
    onDoublePress: () => {
      if (maximized) {
        playClickSound();
      }

      onZoom?.();
    },
  });
  const resizeHandlers = usePointerDrag({
    start: (event) => {
      playClickSound();
      setIsResizing(true);
      setIsResizePressed(true);

      return {
        width,
        height,
        origin: clientPositionOf(event),
        bounds: event.currentTarget.getBoundingClientRect(),
      };
    },
    onDragMove: (delta, from) => {
      reportDrag({ kind: "resize", width: from.width + delta.dx, height: from.height + delta.dy });

      if (!containsPoint(from.bounds, { x: from.origin.x + delta.dx, y: from.origin.y + delta.dy })) {
        setIsResizePressed(false);
      }
    },
    onEnd: () => {
      const drag = endDrag();

      setIsResizing(false);
      setIsResizePressed(false);

      if (drag?.kind === "resize") {
        onResize?.(drag.width, drag.height);
      }
    },
  });

  return { titleBarHandlers: mergeHandlers(moveHandlers, zoomHandlers), resizeHandlers, isResizing, isResizePressed };
}
