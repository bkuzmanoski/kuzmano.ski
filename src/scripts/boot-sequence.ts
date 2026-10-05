import {
  clearBootSequenceOverlay,
  clearBootSequenceThemeColor,
  setBootSequenceOverlay,
} from "#/lib/boot-sequence/overlay.ts";
import { shouldRunBootSequence } from "#/lib/boot-sequence/session.ts";

// Runs in the document head before first paint (prior to hydration) to hide the server-rendered
// desktop until the boot sequence has loaded.

if (shouldRunBootSequence()) {
  setBootSequenceOverlay();
  addEventListener(
    "error",
    () => {
      clearBootSequenceOverlay();
      clearBootSequenceThemeColor();
    },
    { capture: true, once: true },
  );
} else {
  clearBootSequenceThemeColor();
}
