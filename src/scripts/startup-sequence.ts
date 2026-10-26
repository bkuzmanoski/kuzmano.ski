import {
  clearStartupSequenceOverlay,
  clearStartupSequenceThemeColor,
  setStartupSequenceOverlay,
} from "#/lib/startup-sequence/overlay.ts";
import { shouldRunStartupSequence } from "#/lib/startup-sequence/session.ts";

// Runs in the document head before first paint (prior to hydration) to hide the server-rendered
// desktop until the startup sequence has loaded.

if (shouldRunStartupSequence()) {
  setStartupSequenceOverlay();
  addEventListener(
    "error",
    () => {
      clearStartupSequenceOverlay();
      clearStartupSequenceThemeColor();
    },
    { capture: true, once: true },
  );
} else {
  clearStartupSequenceThemeColor();
}
