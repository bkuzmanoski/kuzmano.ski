import { createEmitter } from "../emitter";
import { clearStorage } from "../storage";

import { clearBootSequenceOverlay } from "./overlay";
import { forgetBootSequenceRun, rememberBootSequenceRun, shouldRunBootSequence } from "./session";

let isComplete = false;

const { emit, subscribe } = createEmitter();

export function beginBootSequence() {
  rememberBootSequenceRun();
  clearBootSequenceOverlay();
}

export function completeBootSequence() {
  isComplete = true;
  emit();
}

export const subscribeToIsBootSequenceComplete = subscribe;
export const getIsBootSequenceComplete = () => isComplete || !shouldRunBootSequence();
export const serverIsBootSequenceComplete = () => true;

export function restart() {
  clearStorage();
  forgetBootSequenceRun();
  window.location.replace("/");
}
