import { MAX_LOADING_MS, clearBootOverlay, setBootOverlay, shouldBoot } from "#/lib/boot";

/* Runs in the document head before first paint (prior to hydration) to hide the
 * server-rendered desktop until the boot sequence has run. The timeout is a
 * failsafe: if hydration never removes the cover, the timer removes it. */
if (shouldBoot()) {
  setBootOverlay();
  setTimeout(clearBootOverlay, MAX_LOADING_MS);
}
