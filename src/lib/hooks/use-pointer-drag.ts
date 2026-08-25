import { useEffect, useRef } from "react";

import { isPrimaryPress } from "../press";

import type { PointerEvent as ReactPointerEvent } from "react";

export interface DragDelta {
  dx: number;
  dy: number;
}

/** The travel past which a press counts as a drag, for handles that also answer a click. */
export const DRAG_THRESHOLD = 4;

interface ActiveDrag<T> {
  pointerId: number;
  x: number;
  y: number;
  value: T;
  moved: boolean;
  handle: Element;
  listening: AbortController;
}

export function usePointerDrag<T>({
  threshold = 0,
  preventDefault = false,
  canStart,
  start,
  onDragMove,
  onEnd,
}: {
  threshold?: number;
  preventDefault?: boolean;
  canStart?: (event: ReactPointerEvent) => boolean;
  start: (event: ReactPointerEvent) => T;
  onDragMove: (delta: DragDelta, start: T) => void;
  onEnd?: (moved: boolean) => void;
}) {
  const dragRef = useRef<ActiveDrag<T> | null>(null);
  const pendingDeltaRef = useRef<{ delta: DragDelta; value: T } | null>(null);
  const frameRef = useRef<number | null>(null);

  // The listeners a drag registers outlive the render that registered them, so the gesture is
  // reported through the handlers the caller holds now rather than the ones it held at the press.
  const reportRef = useRef({ onDragMove, onEnd });

  useEffect(() => {
    reportRef.current = { onDragMove, onEnd };
  });

  function cancelFrame() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }

  function flush() {
    const nextDelta = pendingDeltaRef.current;
    pendingDeltaRef.current = null;

    if (nextDelta) {
      reportRef.current.onDragMove(nextDelta.delta, nextDelta.value);
    }
  }

  function finish(active: ActiveDrag<T>) {
    dragRef.current = null;
    active.listening.abort();

    if (active.handle.hasPointerCapture(active.pointerId)) {
      active.handle.releasePointerCapture(active.pointerId);
    }

    cancelFrame();
    flush();
    reportRef.current.onEnd?.(active.moved);
  }

  useEffect(
    () => () => {
      cancelFrame();
      dragRef.current?.listening.abort();
      dragRef.current = null;
    },
    [],
  );

  function onPointerDown(event: ReactPointerEvent) {
    if (!isPrimaryPress(event) || (canStart && !canStart(event))) {
      return;
    }

    if (preventDefault) {
      event.preventDefault();
    }

    // A press that arrives with a drag still in flight closes that one out first, so the gesture
    // it starts is the only one running and the listeners of the previous one are removed.
    if (dragRef.current) {
      finish(dragRef.current);
    }

    const handle = event.currentTarget;
    const listening = new AbortController();

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      value: start(event),
      moved: false,
      handle,
      listening,
    };

    // Capture lets these listeners observe pointer events even when a handler below stops them.
    // Install them before requesting pointer capture, which can throw if the pointer is no longer
    // active. Once the drag starts, these listeners must be in place to end it.
    const options = { capture: true, signal: listening.signal };

    window.addEventListener("pointermove", onWindowPointerMove, options);
    window.addEventListener("pointerup", onWindowPointerEnd, options);
    window.addEventListener("pointercancel", onWindowPointerEnd, options);

    handle.setPointerCapture(event.pointerId);
  }

  function onWindowPointerMove(event: PointerEvent) {
    const active = dragRef.current;

    if (active?.pointerId !== event.pointerId) {
      return;
    }

    // No buttons are held, so the pointer was released without the gesture receiving the release.
    if (event.buttons === 0) {
      finish(active);
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

  function onWindowPointerEnd(event: PointerEvent) {
    const active = dragRef.current;

    if (active?.pointerId === event.pointerId) {
      finish(active);
    }
  }

  return { onPointerDown };
}
