import { useEffect } from "react";

import { clearStartupSequenceOverlay, clearStartupSequenceThemeColor } from "./overlay.ts";

/** Lifts the startup sequence cover on mount, for a view that renders in place of the desktop. */
export function useDismissStartupSequence() {
  useEffect(() => {
    clearStartupSequenceOverlay();
    clearStartupSequenceThemeColor();
  }, []);
}
