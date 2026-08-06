export const HAS_BOOTED_STORAGE_KEY = "has-booted";

/**
 * The time to wait for the assets to load before the boot sequence begins.
 * Also, the longest time the boot sequence cover can hide the desktop.
 */
export const MAX_LOADING_MS = 5000;

/* Set on `<html>` to hide the server-rendered desktop until the boot sequence
 * has run. The stylesheet draws the cover from this attribute. */
const BOOT_OVERLAY_ATTRIBUTE = "data-boot";

export const setBootOverlay = () => document.documentElement.setAttribute(BOOT_OVERLAY_ATTRIBUTE, "");

/**
 * Removes the cover set by the pre-hydration script.
 *
 * The boot sequence removes it as it begins. A view that draws in place of the desktop must
 * also remove it, or it will hide that view until the failsafe timer in the script runs.
 */
export const clearBootOverlay = () => document.documentElement.removeAttribute(BOOT_OVERLAY_ATTRIBUTE);

let bootDecision: boolean | null = null;

export function shouldBoot(): boolean {
  bootDecision ??= (() => {
    try {
      return window.location.pathname === "/" && !sessionStorage.getItem(HAS_BOOTED_STORAGE_KEY);
    } catch {
      return false;
    }
  })();

  return bootDecision;
}

export function setHasBooted() {
  try {
    sessionStorage.setItem(HAS_BOOTED_STORAGE_KEY, "1");
  } catch {
    // Ignored.
  }
}

let isBootSequenceComplete = false;

const listeners = new Set<() => void>();

export function setIsBootSequenceComplete() {
  isBootSequenceComplete = true;

  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToIsBootSequenceComplete(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getIsBootSequenceComplete = () => isBootSequenceComplete || !shouldBoot();

/* The `data-boot` cover hides the server-rendered desktop until
 * hydration decides otherwise so the hand-off is not seen. */
export const serverIsBootSequenceComplete = () => true;
