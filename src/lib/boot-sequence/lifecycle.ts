import { createEmitter } from "../emitter";
import { removeStored } from "../storage";

import { clearBootSequenceOverlay, clearBootSequenceThemeColor } from "./overlay";
import {
  BOOT_SEQUENCE_STORAGE_KEY,
  forgetBootSequenceRun,
  rememberBootSequenceRun,
  shouldRunBootSequence,
} from "./session";

let isComplete = false;

const { emit, subscribe } = createEmitter();

export function beginBootSequence() {
  rememberBootSequenceRun();
  clearBootSequenceOverlay();
}

export function completeBootSequence() {
  clearBootSequenceThemeColor();
  isComplete = true;
  emit();
}

export const subscribeToIsBootSequenceComplete = subscribe;
export const getIsBootSequenceComplete = () => isComplete || !shouldRunBootSequence();
export const serverIsBootSequenceComplete = () => true;

export function restart() {
  removeStored(BOOT_SEQUENCE_STORAGE_KEY);
  forgetBootSequenceRun();
  window.location.replace("/");
}
