import { useEffect, useRef } from "react";

import type { PointerEvent as ReactPointerEvent } from "react";

export interface DragDelta {
  dx: number;
  dy: number;
}

/** The travel past which a press counts as a drag, for handles that also answer a click. */
export const DRAG_THRESHOLD = 4;

export function usePointerDrag<T>({
  threshold = 0,
  preventDefault = false,
  canStart,
  start,
  onStart,
  onEnd,
}: {
  threshold?: number;
  preventDefault?: boolean;
  canStart?: (event: ReactPointerEvent) => boolean;
  start: () => T;
  onStart: (delta: DragDelta, start: T) => void;
  onEnd?: (moved: boolean) => void;
}) {
  const dragRef = useRef<{ x: number; y: number; value: T; moved: boolean } | null>(null);
  const pendingDeltaRef = useRef<{ delta: DragDelta; value: T } | null>(null);
  const frameRef = useRef<number | null>(null);

  function cancelFrame() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }

  useEffect(() => cancelFrame, []);

  function flush() {
    const nextDelta = pendingDeltaRef.current;
    pendingDeltaRef.current = null;

    if (nextDelta) {
      onStart(nextDelta.delta, nextDelta.value);
    }
  }

  function onPointerDown(event: ReactPointerEvent) {
    if (canStart && !canStart(event)) {
      return;
    }

    if (preventDefault) {
      event.preventDefault();
    }

    dragRef.current = { x: event.clientX, y: event.clientY, value: start(), moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent) {
    const active = dragRef.current;

    if (!active) {
      return;
    }

    const delta = { dx: event.clientX - active.x, dy: event.clientY - active.y };

    if (Math.abs(delta.dx) > threshold || Math.abs(delta.dy) > threshold) {
      active.moved = true;
    }

    // Nothing is reported until the press has travelled past the threshold, so a handle that
    // also answers a click is not nudged by the jitter of one. Once set, the flag stays set for
    // the rest of the press, so a drag that comes back within the threshold keeps reporting
    // rather than stalling where it last crossed it.
    if (!active.moved) {
      return;
    }

    pendingDeltaRef.current = { delta, value: active.value };

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      flush();
    });
  }

  function endDrag(event: ReactPointerEvent) {
    const activeDrag = dragRef.current;

    if (!activeDrag) {
      return;
    }

    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    cancelFrame();
    flush();
    onEnd?.(activeDrag.moved);
  }

  return { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag };
}
