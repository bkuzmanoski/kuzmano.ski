// This module has no imports, so the pre-hydration boot sequence script can use it (see `/build/inline-scripts.ts`).

export const BOOT_SEQUENCE_STORAGE_KEY = "boot-sequence-run";

let cachedShouldRun: boolean | null = null;

export function shouldRunBootSequence(): boolean {
  cachedShouldRun ??= (() => {
    try {
      return window.location.pathname === "/" && !sessionStorage.getItem(BOOT_SEQUENCE_STORAGE_KEY);
    } catch {
      return false;
    }
  })();

  return cachedShouldRun;
}

export function rememberBootSequenceRun() {
  try {
    sessionStorage.setItem(BOOT_SEQUENCE_STORAGE_KEY, "1");
  } catch {
    // Ignored.
  }
}

export function forgetBootSequenceRun() {
  try {
    sessionStorage.removeItem(BOOT_SEQUENCE_STORAGE_KEY);
  } catch {
    // Ignored.
  }
}
