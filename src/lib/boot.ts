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

export function markBooted() {
  try {
    sessionStorage.setItem(HAS_BOOTED_STORAGE_KEY, "1");
  } catch {
    // Ignored.
  }
}

let hasBooted = false;

const listeners = new Set<() => void>();

export function markHasBooted() {
  hasBooted = true;

  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToHasBooted(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getHasBooted = () => hasBooted || !shouldBoot();

/* The server renders the desktop ready. The `data-boot` cover hides it until
 * hydration decides otherwise, so the hand-off is never seen. */
export const serverHasBooted = () => true;
