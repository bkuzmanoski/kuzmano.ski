import { createClientStore } from "../client-store.ts";
import { clearStorage } from "../storage.ts";

import { clearStartupSequenceOverlay, clearStartupSequenceThemeColor } from "./overlay.ts";
import { forgetStartupSequenceRun, rememberStartupSequenceRun, shouldRunStartupSequence } from "./session.ts";

const { useValue, setValue } = createClientStore(true, () => !shouldRunStartupSequence());

export function beginStartupSequence() {
  rememberStartupSequenceRun();
  clearStartupSequenceOverlay();
}

export function completeStartupSequence() {
  clearStartupSequenceThemeColor();
  setValue(true);
}

export const useIsStartupSequenceComplete = useValue;

export function restart() {
  clearStorage();
  forgetStartupSequenceRun();
  window.location.replace("/");
}
