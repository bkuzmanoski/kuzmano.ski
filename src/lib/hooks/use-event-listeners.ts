import { useEffect, useEffectEvent } from "react";

type EventMapOf<TTarget extends "window" | "document"> = TTarget extends "window" ? WindowEventMap : DocumentEventMap;

export type EventListeners<TTarget extends "window" | "document"> = {
  [TType in keyof EventMapOf<TTarget>]?: (event: EventMapOf<TTarget>[TType]) => void;
};

export interface EventListenerOptions {
  capture?: boolean;
  passive?: boolean;
  /** Removes the listeners while `false`. */
  enabled?: boolean;
}

/**
 * Registers listeners for each event type in `listeners` on `window` or `document` after mount, then removes them on
 * unmount. Listeners always call the latest handler without being re-registered; they are re-registered only when the
 * target, event types, or options change.
 */
export function useEventListeners<TTarget extends "window" | "document">(
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

    const controller = new AbortController();
    const eventTarget = target === "window" ? window : document;

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
