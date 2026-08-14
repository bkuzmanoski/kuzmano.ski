import { createEmitter } from "../emitter";

export const HAS_BOOTED_STORAGE_KEY = "has-booted";

/* Set on `<html>` to hide the server-rendered desktop until the boot sequence
 * has run. The stylesheet shows the cover while this attribute is set. */
const BOOT_OVERLAY_ATTRIBUTE = "data-boot";

export const setBootOverlay = () => document.documentElement.setAttribute(BOOT_OVERLAY_ATTRIBUTE, "");

/** Removes the cover set by the pre-hydration script. */
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

const { emit, subscribe } = createEmitter();

export function setIsBootSequenceComplete() {
  isBootSequenceComplete = true;
  emit();
}

export const subscribeToIsBootSequenceComplete = subscribe;

export const getIsBootSequenceComplete = () => isBootSequenceComplete || !shouldBoot();

/* The `data-boot` cover hides the server-rendered desktop until
 * hydration decides otherwise so the hand-off is not seen. */
export const serverIsBootSequenceComplete = () => true;

/** Clears saved settings and reloads the desktop so the boot runs again. */
export function reset() {
  try {
    localStorage.clear();
    sessionStorage.removeItem(HAS_BOOTED_STORAGE_KEY);
  } catch {
    // Ignored.
  }

  window.location.replace("/");
}
