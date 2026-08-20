import { useSyncExternalStore } from "react";

import { createEmitter } from "../emitter";

import { clearScreensaverThemeColor, setScreensaverThemeColor } from "./theme-color";

export const FADE_IN_MS = 300;

/**
 * Only `asleep` answers to input. The gesture that chose Sleep from the menu must not
 * trail into dismissing the screensaver on its way out, so `falling-asleep` ignores it.
 */
export type SleepState = "awake" | "falling-asleep" | "asleep";

let state: SleepState = "awake";

const { emit, subscribe } = createEmitter();

const getState = () => state;
const serverState = (): SleepState => "awake";

function enter(next: SleepState) {
  state = next;

  // The browser chrome follows the screensaver up and back down with it (see `theme-color.ts`).
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
    setTimeout(() => enter("asleep"), FADE_IN_MS); // Nothing else can leave `falling-asleep`, so this needs no guard of its own.
  }
}

/** Wakes the desktop. Ignored while the screensaver is still on its way up. */
export function wake() {
  if (state === "asleep") {
    enter("awake");
  }
}

export const useSleepState = () => useSyncExternalStore(subscribe, getState, serverState);
