import { createClientStore } from "../client-store.ts";
import { clearStorage } from "../storage.ts";

import { clearBootSequenceOverlay, clearBootSequenceThemeColor } from "./overlay.ts";
import { forgetBootSequenceRun, rememberBootSequenceRun, shouldRunBootSequence } from "./session.ts";

const { useValue, setValue } = createClientStore(true, () => !shouldRunBootSequence());

export function beginBootSequence() {
  rememberBootSequenceRun();
  clearBootSequenceOverlay();
}

export function completeBootSequence() {
  clearBootSequenceThemeColor();
  setValue(true);
}

export const useIsBootSequenceComplete = useValue;

export function restart() {
  clearStorage();
  forgetBootSequenceRun();
  window.location.replace("/");
}
