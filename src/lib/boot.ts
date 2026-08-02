export const HAS_BOOTED_STORAGE_KEY = "has-booted";

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

/* The server renders the desktop ready. The `data-boot` cover hides it until
 * hydration decides otherwise, so the hand-off is never seen. */
export const serverIsBootSequenceComplete = () => true;
