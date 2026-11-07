// Imports only leaf modules because pre-hydration scripts bundle this module (see `/build/inline-scripts.ts`).
import { SESSION_STORAGE, removeStored, writeStored } from "../storage.ts";

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

export const rememberStartupSequenceRun = () => writeStored(STARTUP_SEQUENCE_STORAGE_KEY, "1", SESSION_STORAGE);
export const forgetStartupSequenceRun = () => removeStored(STARTUP_SEQUENCE_STORAGE_KEY, SESSION_STORAGE);
