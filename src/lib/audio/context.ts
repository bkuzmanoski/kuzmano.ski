import { useEffect } from "react";

import { getSettings } from "../settings";

/** Keys that do not give the document user activation. They cannot unlock audio. */
export const NON_GESTURE_KEYS = new Set([
  "Alt",
  "CapsLock",
  "Control",
  "Escape",
  "Meta",
  "NumLock",
  "ScrollLock",
  "Shift",
]);

/**
 * Web Audio runs on its own thread and renders ahead of `currentTime`, so anything
 * scheduled at `currentTime` is partly in the past by the time it is rendered.
 * */
export const LEAD_TIME = 0.02;

const OUTPUT_GAIN = 0.2;

let audioContext: AudioContext | null = null;
let output: GainNode | null = null;
let unlocking: Promise<void> | null = null;

/** True if the document has had a user gesture. */
const hasUserActivation = () => (navigator as Partial<Navigator>).userActivation?.hasBeenActive ?? true; // Not all browsers support this.

/**
 * The audio context, created on first use. A context created before the first user
 * gesture has no value: the autoplay policy keeps it suspended and logs a warning.
 * Without a gesture this returns null.
 */
function openAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }

  const Constructor = typeof window === "undefined" ? undefined : window.AudioContext;

  if (!Constructor || !hasUserActivation()) {
    return null;
  }

  audioContext = new Constructor({ latencyHint: "interactive" });

  return audioContext;
}

function unlockAudioOnKeyDown(event: KeyboardEvent): void {
  if (!NON_GESTURE_KEYS.has(event.key)) {
    unlockAudio();
  }
}

function resumeAudioContext(context: AudioContext): Promise<void> {
  if (context.state === "running") {
    return Promise.resolve();
  }

  unlocking ??= context
    .resume()
    .catch(() => {
      // Ignored.
    })
    .finally(() => {
      unlocking = null;
    });

  return unlocking;
}

/* Resumes a context created by an earlier gesture that the
 * browser suspended while the tab was in the background. */
function resumeAudioOnReturn(): void {
  if (!audioContext || document.visibilityState !== "visible" || getSettings().sound !== "on") {
    return;
  }

  void resumeAudioContext(audioContext);
}

/** Global gain node for all audio. */
export function getGainNode(context: AudioContext): GainNode {
  if (!output) {
    output = context.createGain();
    output.gain.value = OUTPUT_GAIN;
    output.connect(context.destination);
  }

  return output;
}

/**
 * Readies the audio context for later playback. Browsers only allow this
 * from a trusted user gesture, and the activation is transient, so call
 * it synchronously from the handler—anything awaited first can lose it.
 */
export function unlockAudio(): void {
  if (getSettings().sound !== "on") {
    return;
  }

  const context = openAudioContext();

  if (context) {
    void resumeAudioContext(context);
  }
}

export function useAudioUnlock() {
  useEffect(() => {
    document.addEventListener("pointerdown", unlockAudio, { capture: true, passive: true }); // Mouse clicks
    document.addEventListener("pointerup", unlockAudio, { capture: true, passive: true }); // Touch taps
    document.addEventListener("keydown", unlockAudioOnKeyDown, { capture: true, passive: true });
    document.addEventListener("visibilitychange", resumeAudioOnReturn);

    return () => {
      document.removeEventListener("pointerdown", unlockAudio, true);
      document.removeEventListener("pointerup", unlockAudio, true);
      document.removeEventListener("keydown", unlockAudioOnKeyDown, true);
      document.removeEventListener("visibilitychange", resumeAudioOnReturn);
    };
  }, []);
}

/**
 * If the context is already running (once `unlockAudio` has fired once this
 * session) this is synchronous. If it isn't—e.g. this is the very first
 * interaction—it falls back to resuming inline, which only works if this
 * call is inside a trusted user gesture.
 */
export function playSound(play: (context: AudioContext) => void) {
  if (getSettings().sound !== "on") {
    return;
  }

  const context = openAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "running") {
    play(context);
    return;
  }

  void resumeAudioContext(context)
    .then(() => {
      if (context.state === "running") {
        play(context);
      }
    })
    .catch(() => {
      // Ignored.
    });
}
