// This module has no imports, so the pre-hydration startup sequence script can use it (see `/build/inline-scripts.ts`).

export const STARTUP_SEQUENCE_STORAGE_KEY = "startup-sequence-run";

let cachedShouldRun: boolean | null = null;

export function shouldRunStartupSequence(): boolean {
  cachedShouldRun ??= (() => {
    try {
      return window.location.pathname === "/" && !sessionStorage.getItem(STARTUP_SEQUENCE_STORAGE_KEY);
    } catch {
      return false;
    }
  })();

  return cachedShouldRun;
}

export function rememberStartupSequenceRun() {
  try {
    sessionStorage.setItem(STARTUP_SEQUENCE_STORAGE_KEY, "1");
  } catch {
    // Ignored.
  }
}

export function forgetStartupSequenceRun() {
  try {
    sessionStorage.removeItem(STARTUP_SEQUENCE_STORAGE_KEY);
  } catch {
    // Ignored.
  }
}
