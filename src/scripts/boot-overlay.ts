import { clearBootOverlay, setBootOverlay, shouldBoot } from "#/lib/boot-sequence/boot";

/* Runs in the document head before first paint (prior to hydration) to hide the server-
 * rendered desktop until the boot sequence has loaded. Hydration lifts the cover.  */
if (shouldBoot()) {
  setBootOverlay();
  addEventListener("error", clearBootOverlay, { capture: true, once: true }); // Remove the cover if a script fails to load or throws.
}
