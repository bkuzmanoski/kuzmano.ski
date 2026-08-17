// This module has no imports, so the pre-hydration overlay script can use it (see
// `build/inline-script.ts`). Session storage can be blocked entirely (cookies
// disabled), so every access is wrapped in a try/catch.

export const BOOT_SEQUENCE_STORAGE_KEY = "boot-sequence-run";

let shouldRun: boolean | null = null;

export function shouldRunBootSequence(): boolean {
  shouldRun ??= (() => {
    try {
      return window.location.pathname === "/" && !sessionStorage.getItem(BOOT_SEQUENCE_STORAGE_KEY);
    } catch {
      return false;
    }
  })();

  return shouldRun;
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
