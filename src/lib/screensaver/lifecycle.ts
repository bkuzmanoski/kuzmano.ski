import { useSyncExternalStore } from "react";

import { createEmitter } from "../emitter.ts";

import { clearScreensaverThemeColor, setScreensaverThemeColor } from "./theme-color.ts";

export const FADE_IN_DURATION_MS = 300;

/**
 * Only `asleep` responds to input. The gesture that selected Sleep from the menu must not
 * carry through and dismiss the screensaver, so `falling-asleep` ignores input.
 */
export type SleepState = "awake" | "falling-asleep" | "asleep";

let state: SleepState = "awake";

// This store is hand-rolled instead of using `createClientStore` because it has no client-only
// initial value: the desktop is awake on the server and first client paint, and only transitions change it.
const { emit, subscribe } = createEmitter();
const getState = () => state;
const serverState = (): SleepState => "awake";

function enter(next: SleepState) {
  state = next;

  // The browser chrome follows the screensaver up and back down with it (see `/src/lib/screensaver/theme-color.ts`).
  if (next === "awake") {
    clearScreensaverThemeColor();
  } else {
    setScreensaverThemeColor();
  }

  emit();
}

/** Puts the desktop to sleep, raising the screensaver over it. */
export function sleep() {
  if (state === "awake") {
    enter("falling-asleep");
    setTimeout(() => enter("asleep"), FADE_IN_DURATION_MS); // Only this timer leaves the `falling-asleep` state, so it does not need a guard of its own.
  }
}

/**
 * Puts the desktop to sleep once the visitor has gone idle, unless an alert is
 * waiting on them as an alert opened with `showModal()` sits in the browser's top
 * layer, above any stacking context the screensaver can claim.
 */
export function sleepOnIdle() {
  if (!document.querySelector("dialog[open]")) {
    sleep();
  }
}

/** Wakes the desktop. Ignored while the screensaver is still on its way up. */
export function wake() {
  if (state === "asleep") {
    enter("awake");
  }
}

export const useSleepState = () => useSyncExternalStore(subscribe, getState, serverState);
