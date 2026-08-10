import { useEffect } from "react";

import { clearBootOverlay } from "../boot";

/** Lifts the boot cover on mount, for a view that draws in place of the desktop. */
export function useClearBootOverlay() {
  useEffect(() => {
    clearBootOverlay();
  }, []);
}
