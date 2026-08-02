import { useEffect, useRef } from "react";

import type { PointerEvent as ReactPointerEvent } from "react";

export interface DragDelta {
  dx: number;
  dy: number;
}

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

    pendingDeltaRef.current = { delta, value: active.value };

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        flush();
      });
    }
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
