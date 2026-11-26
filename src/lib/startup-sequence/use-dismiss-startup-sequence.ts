import { useEffect } from "react";

import { clearStartupSequenceOverlay, clearStartupSequenceThemeColor } from "./overlay.ts";

/** Clears the startup sequence overlay and theme color on mount for a view that replaces the desktop. */
export function useDismissStartupSequence() {
  useEffect(() => {
    clearStartupSequenceOverlay();
    clearStartupSequenceThemeColor();
  }, []);
}
