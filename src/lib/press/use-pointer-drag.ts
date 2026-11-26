import { useEffect, useRef } from "react";

import { clientPositionOf, distanceBetween } from "../geometry.ts";

import { isPrimaryPress } from "./press.ts";

import type { PointerEvent as ReactPointerEvent } from "react";

export interface DragDelta {
  dx: number;
  dy: number;
}

/** Details passed to `onEnd` alongside whether the drag moved. */
export interface DragEnd<T> {
  /** The value `start` returned at the press. */
  start: T;
  /**
   * Whether the browser canceled the gesture with `pointercancel` (e.g., to pan the page from a handle that allows it
   * with `touch-action`), instead of the user releasing the pointer.
   */
  isCanceled: boolean;
}

/** The travel past which a press counts as a drag, for handles that also respond to a click. */
export const DRAG_THRESHOLD_PX = 4;

interface ActiveDrag<T> {
  pointerId: number;
  x: number;
  y: number;
  value: T;
  moved: boolean;
  handle: Element;
  controller: AbortController;
}

export function usePointerDrag<T>({
  threshold = 0,
  preventDefault = false,
  endsOnSecondTouch = false,
  canStart,
  start,
  onDragMove,
  onEnd,
}: {
  threshold?: number;
  preventDefault?: boolean;
  /**
   * Cancel a touch drag when a second touch begins anywhere in the window. Use this when the handle's `touch-action`
   * allows pinch-zoom (e.g., `pan-y pinch-zoom`): the browser may not cancel the first pointer, so pinch movement could
   * otherwise be interpreted as drag travel.
   */
  endsOnSecondTouch?: boolean;
  canStart?: (event: ReactPointerEvent) => boolean;
  /** Returns the gesture's starting state, or `null` to ignore the press. */
  start: (event: ReactPointerEvent) => T | null;
  onDragMove: (delta: DragDelta, start: T) => void;
  onEnd?: (moved: boolean, end: DragEnd<T>) => void;
}) {
  const activeDragRef = useRef<ActiveDrag<T> | null>(null);
  const pendingDeltaRef = useRef<{ delta: DragDelta; value: T } | null>(null);
  const frameRef = useRef<number | null>(null);

  /** The second touch's `pointerdown` event, tracked to prevent it from starting a new drag. */
  const secondTouchEventRef = useRef<PointerEvent | null>(null);

  // Drag listeners outlive the render that registered them, so use the latest handlers rather than those from the
  // press.
  const handlersRef = useRef({ onDragMove, onEnd });

  useEffect(() => {
    handlersRef.current = { onDragMove, onEnd };
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
      handlersRef.current.onDragMove(nextDelta.delta, nextDelta.value);
    }
  }

  function finish(activeDrag: ActiveDrag<T>, { isCanceled = false } = {}) {
    activeDragRef.current = null;
    activeDrag.controller.abort();

    if (activeDrag.handle.hasPointerCapture(activeDrag.pointerId)) {
      activeDrag.handle.releasePointerCapture(activeDrag.pointerId);
    }

    cancelFrame();

    // Drop unreported movement on cancellation: it may belong to the gesture that took over, such as a pinch.
    if (isCanceled) {
      pendingDeltaRef.current = null;
    } else {
      flush();
    }

    handlersRef.current.onEnd?.(activeDrag.moved, { start: activeDrag.value, isCanceled });
  }

  // Unmounting drops a drag still in progress without flushing the pending move or calling `onEnd`, so a caller that
  // commits in `onEnd` records nothing for it. This assumes the handle outlives the gesture.
  useEffect(
    () => () => {
      cancelFrame();
      activeDragRef.current?.controller.abort();
      activeDragRef.current = null;
      secondTouchEventRef.current = null;
    },
    [],
  );

  function onPointerDown(event: ReactPointerEvent) {
    const secondTouchEvent = secondTouchEventRef.current;

    secondTouchEventRef.current = null;

    if (event.nativeEvent === secondTouchEvent) {
      return; // The window capture listener has already canceled the drag for this second touch; don't start another one.
    }

    if (!isPrimaryPress(event) || (canStart && !canStart(event))) {
      return;
    }

    // A press that arrives with a drag still in flight closes that one out first, so the gesture it starts is the only
    // one running and the listeners of the previous one are removed.
    if (activeDragRef.current) {
      finish(activeDragRef.current);
    }

    const value = start(event);

    if (value === null) {
      return;
    }

    if (preventDefault) {
      event.preventDefault();
    }

    const handle = event.currentTarget;
    const controller = new AbortController();

    activeDragRef.current = {
      pointerId: event.pointerId,
      ...clientPositionOf(event),
      value,
      moved: false,
      handle,
      controller,
    };

    // Capture lets these listeners observe pointer events even when a handler below stops them. Install them before
    // requesting pointer capture, which can throw if the pointer is no longer active. Once the drag starts, these
    // listeners must be in place to end it.
    const listenerOptions = { capture: true, signal: controller.signal };

    window.addEventListener("pointermove", onWindowPointerMove, listenerOptions);
    window.addEventListener("pointerup", onWindowPointerEnd, listenerOptions);
    window.addEventListener("pointercancel", onWindowPointerEnd, listenerOptions);

    if (endsOnSecondTouch && event.pointerType === "touch") {
      window.addEventListener("pointerdown", onWindowPointerDown, listenerOptions);
    }

    handle.setPointerCapture(event.pointerId);
  }

  function onWindowPointerDown(event: PointerEvent) {
    const activeDrag = activeDragRef.current;

    if (activeDrag && event.pointerType === "touch" && event.pointerId !== activeDrag.pointerId) {
      secondTouchEventRef.current = event;
      finish(activeDrag, { isCanceled: true });
    }
  }

  function onWindowPointerMove(event: PointerEvent) {
    const activeDrag = activeDragRef.current;

    if (activeDrag?.pointerId !== event.pointerId) {
      return;
    }

    // No buttons are held, so the pointer was released without the gesture receiving the release.
    if (event.buttons === 0) {
      finish(activeDrag);
      return;
    }

    const delta = { dx: event.clientX - activeDrag.x, dy: event.clientY - activeDrag.y };

    if (distanceBetween(clientPositionOf(event), activeDrag) > threshold) {
      activeDrag.moved = true;
    }

    if (!activeDrag.moved) {
      return;
    }

    pendingDeltaRef.current = { delta, value: activeDrag.value };

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      flush();
    });
  }

  function onWindowPointerEnd(event: PointerEvent) {
    const activeDrag = activeDragRef.current;

    if (activeDrag?.pointerId === event.pointerId) {
      finish(activeDrag, { isCanceled: event.type === "pointercancel" });
    }
  }

  return { onPointerDown };
}
