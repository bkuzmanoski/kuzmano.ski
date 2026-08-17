import { useEffect } from "react";

import { clearBootSequenceOverlay, clearBootSequenceThemeColor } from "./overlay";

/** Lifts the boot sequence cover on mount, for a view that renders in place of the desktop. */
export function useDismissBootSequence() {
  useEffect(() => {
    clearBootSequenceOverlay();
    clearBootSequenceThemeColor();
  }, []);
}
