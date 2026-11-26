import { useEffect, useEffectEvent } from "react";

type EventTargetName = "window" | "document" | "visualViewport";

type EventMapOf<TTarget extends EventTargetName> = TTarget extends "window"
  ? WindowEventMap
  : TTarget extends "document"
    ? DocumentEventMap
    : VisualViewportEventMap;

export type EventListeners<TTarget extends EventTargetName> = {
  [TType in keyof EventMapOf<TTarget>]?: (event: EventMapOf<TTarget>[TType]) => void;
};

export interface EventListenerOptions {
  capture?: boolean;
  passive?: boolean;
  /** Removes the listeners while `false`. */
  enabled?: boolean;
}

/**
 * Registers listeners for each event type in `listeners` on `window`, `document`, or `window.visualViewport` after
 * mount, then removes them on unmount. Listeners always call the latest handler and re-register only when the target,
 * event types, or options change.
 */
export function useEventListeners<TTarget extends EventTargetName>(
  target: TTarget,
  listeners: EventListeners<TTarget>,
  { capture = false, passive, enabled = true }: EventListenerOptions = {},
): void {
  const dispatch = useEffectEvent((type: string, event: Event) =>
    (listeners as Record<string, ((event: Event) => void) | undefined>)[type]?.(event),
  );
  const eventTypes = Object.keys(listeners).join(" "); // A string, so the effect depends on the set of types by value.

  useEffect(() => {
    if (!enabled || eventTypes === "") {
      return;
    }

    const eventTarget = target === "window" ? window : target === "document" ? document : window.visualViewport;

    if (!eventTarget) {
      return;
    }

    const controller = new AbortController();

    for (const type of eventTypes.split(" ")) {
      eventTarget.addEventListener(type, (event) => dispatch(type, event), {
        capture,
        passive,
        signal: controller.signal,
      });
    }

    return () => controller.abort();
  }, [target, eventTypes, capture, passive, enabled]);
}
