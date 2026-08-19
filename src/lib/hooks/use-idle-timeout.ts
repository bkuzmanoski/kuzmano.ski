import { useEffect, useEffectEvent } from "react";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "wheel"] as const;

/**
 * Calls `onIdle` once `delayMs` has passed without any sign of the visitor. Listens in the
 * capture phase so activity counts even where a handler below stops the event.
 */
export function useIdleTimeout(delayMs: number, isEnabled: boolean, onIdle: () => void) {
  const idle = useEffectEvent(onIdle);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const listening = new AbortController();

    let timer = setTimeout(idle, delayMs);

    function restart() {
      clearTimeout(timer);
      timer = setTimeout(idle, delayMs);
    }

    for (const type of ACTIVITY_EVENTS) {
      document.addEventListener(type, restart, { capture: true, passive: true, signal: listening.signal });
    }

    return () => {
      clearTimeout(timer);
      listening.abort();
    };
  }, [delayMs, isEnabled]);
}
