import { useEffect } from "react";

import { getSettings } from "../settings/settings.ts";

/** Keyboard keys that do not provide user activation for audio. */
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
 * Small lead time for scheduled audio. Web Audio renders ahead of `currentTime`,
 * so scheduling exactly at `currentTime` can already be late when rendered.
 */
export const LEAD_TIME_S = 0.02;

const OUTPUT_GAIN = 0.2;

let audioContext: AudioContext | null = null;
let outputGainNode: GainNode | null = null;
let runningPromise: Promise<void> | null = null;

const hasUserActivation = () => (navigator as Partial<Navigator>).userActivation?.hasBeenActive ?? true;

// Checks only for the standard `running` state. WebKit also reports `interrupted`,
// which should be handled like any other non-running state.
const isRunning = (context: AudioContext) => context.state === "running";

// Returns the shared audio context, creating it only after user activation.
// Creating it earlier leaves the context suspended by autoplay policy.
function openAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }

  const AudioContextConstructor = typeof window === "undefined" ? undefined : window.AudioContext;

  if (!AudioContextConstructor || !hasUserActivation()) {
    return null;
  }

  audioContext = new AudioContextConstructor({ latencyHint: "interactive" });

  return audioContext;
}

// Requests that a context resume if it is not already running. Each call resumes
// independently. A resume can remain pending when issued before iOS accepts the
// gesture, so calls are intentionally not deduplicated.
function ensureResumed(context: AudioContext): void {
  if (!isRunning(context)) {
    void context.resume().catch(() => {
      // Ignored.
    });
  }
}

// Resolves when the context becomes running. Waits for the state transition
// rather than a particular `resume()` promise,  since a resume issued by an
// earlier gesture may never settle.
function whenAudioRunning(context: AudioContext): Promise<void> {
  if (isRunning(context)) {
    return Promise.resolve();
  }

  runningPromise ??= new Promise<void>((resolve) => {
    const onStateChange = () => {
      if (isRunning(context)) {
        context.removeEventListener("statechange", onStateChange);
        runningPromise = null;
        resolve();
      }
    };

    context.addEventListener("statechange", onStateChange);
  });

  return runningPromise;
}

/** Returns the shared output gain node. */
export function getGainNode(context: AudioContext): GainNode {
  if (!outputGainNode) {
    outputGainNode = context.createGain();
    outputGainNode.gain.value = OUTPUT_GAIN;
    outputGainNode.connect(context.destination);
  }

  return outputGainNode;
}

// Resumes the audio context when a backgrounded tab becomes visible again.
function resumeAudioOnReturn(): void {
  if (!audioContext || document.visibilityState !== "visible" || getSettings().soundEffects !== "on") {
    return;
  }

  ensureResumed(audioContext);
}

export const needsAudioPriming = (): boolean =>
  getSettings().soundEffects === "on" && !(audioContext !== null && isRunning(audioContext));

/**
 * Primes the audio context for later playback.
 *
 * Must be called synchronously from a trusted user gesture because browsers
 * restrict audio activation to the gesture that triggers it.
 */
export function primeAudio(): void {
  if (getSettings().soundEffects !== "on") {
    return;
  }

  const context = openAudioContext();

  if (context) {
    ensureResumed(context);
  }
}

function primeAudioOnKeyDown(event: KeyboardEvent): void {
  if (!NON_GESTURE_KEYS.has(event.key)) {
    primeAudio();
  }
}

export function useAudioUnlock() {
  useEffect(() => {
    const controller = new AbortController();
    const listenerOptions = { capture: true, passive: true, signal: controller.signal };

    document.addEventListener("pointerdown", primeAudio, listenerOptions); // Mouse clicks.
    document.addEventListener("pointerup", primeAudio, listenerOptions); // Touch taps.
    document.addEventListener("keydown", primeAudioOnKeyDown, listenerOptions);
    document.addEventListener("visibilitychange", resumeAudioOnReturn, { signal: controller.signal });

    return () => controller.abort();
  }, []);
}

/**
 * Plays a sound once the audio context is running.
 *
 * Playback is synchronous when the context is already running. Otherwise the
 * context is resumed and playback waits for its `running` state.
 */
export function playSound(play: (context: AudioContext) => void) {
  if (getSettings().soundEffects !== "on") {
    return;
  }

  const context = openAudioContext();

  if (!context) {
    return;
  }

  if (isRunning(context)) {
    play(context);
    return;
  }

  ensureResumed(context);

  void whenAudioRunning(context).then(() => play(context));
}
