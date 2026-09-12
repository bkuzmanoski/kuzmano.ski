import { useEffect, useEffectEvent } from "react";

const ACTIVITY_EVENTS = ["keydown", "pointerdown", "pointermove", "wheel"] as const;

/**
 * Calls `onIdle` once `delayMs` has passed without any sign of the visitor. Listens in the
 * capture phase so activity counts even where a handler below stops the event.
 */
export function useIdleTimeout(delayMs: number, isEnabled: boolean, onIdle: () => void) {
  const reportIdle = useEffectEvent(onIdle);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const activityListeners = new AbortController();

    let timer = setTimeout(reportIdle, delayMs);

    function restart() {
      clearTimeout(timer);
      timer = setTimeout(reportIdle, delayMs);
    }

    for (const type of ACTIVITY_EVENTS) {
      document.addEventListener(type, restart, { capture: true, passive: true, signal: activityListeners.signal });
    }

    return () => {
      clearTimeout(timer);
      activityListeners.abort();
    };
  }, [delayMs, isEnabled]);
}
