import { useEffect, useEffectEvent } from "react";

// Adds the missing `CloseWatcher` declaration to the window type.
interface WindowWithCloseWatcher {
  CloseWatcher: new () => { onclose: (() => void) | null; destroy: () => void };
}

/**
 * Calls `onCloseRequest` when the browser dispatches a close request (e.g., the Android back gesture) while the caller
 * is mounted, where the browser provides `CloseWatcher` (Chrome 126, Firefox 149, Safari 27.3).
 */
export function useCloseWatcher(onCloseRequest: () => void): void {
  const handleCloseRequest = useEffectEvent(onCloseRequest);
  useEffect(() => {
    if (!("CloseWatcher" in window)) {
      return;
    }

    const closeWatcher = new (window as WindowWithCloseWatcher).CloseWatcher();

    closeWatcher.onclose = () => handleCloseRequest();

    return () => closeWatcher.destroy();
  }, []);
}
