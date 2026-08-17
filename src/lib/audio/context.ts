import { useEffect } from "react";

import { getSettings } from "../settings";

/** Keys that do not give the document user activation. They cannot open an audio context. */
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
let whenRunning: Promise<void> | null = null;

// True if the document has had a user gesture.
const hasUserActivation = () => (navigator as Partial<Navigator>).userActivation?.hasBeenActive ?? true;

// The one way state is ever inspected. WebKit also reports a non-standard
// "interrupted" state (phone call, Siri, lock screen); comparing against
// "running" treats it like "suspended" without a cast.
const isRunning = (context: AudioContext) => context.state === "running";

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

function primeAudioOnKeyDown(event: KeyboardEvent): void {
  if (!NON_GESTURE_KEYS.has(event.key)) {
    primeAudio();
  }
}

// Every call issues a fresh `resume()`. Concurrent calls are safe—they all settle
// when the context transitions—while a resume issued from a moment iOS does not
// honor (e.g. the touchstart phase of a tap) can stay pending forever. Deduping on
// such a promise would swallow the resume from the next, valid gesture and leave
// audio dead for the session.
function ensureResumed(context: AudioContext): void {
  if (!isRunning(context)) {
    void context.resume().catch(() => {
      // Ignored.
    });
  }
}

// Resolves when the context is actually running, keyed to the state transition
// itself rather than to any one `resume()` promise, so it settles no matter which
// gesture's resume finally lands.
function whenAudioRunning(context: AudioContext): Promise<void> {
  if (isRunning(context)) {
    return Promise.resolve();
  }

  whenRunning ??= new Promise<void>((resolve) => {
    const onStateChange = () => {
      if (isRunning(context)) {
        context.removeEventListener("statechange", onStateChange);
        whenRunning = null;
        resolve();
      }
    };

    context.addEventListener("statechange", onStateChange);
  });

  return whenRunning;
}

// Resumes a context created by an earlier gesture that the
// browser suspended while the tab was in the background.
function resumeAudioOnReturn(): void {
  if (!audioContext || document.visibilityState !== "visible" || getSettings().sound !== "on") {
    return;
  }

  ensureResumed(audioContext);
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

export const needsAudioPriming = (): boolean =>
  getSettings().sound === "on" && !(audioContext !== null && isRunning(audioContext));

/**
 * Readies the audio context for later playback. Browsers only allow this
 * from a trusted user gesture, and the activation is transient, so call
 * it synchronously from the handler.
 */
export function primeAudio(): void {
  if (getSettings().sound !== "on") {
    return;
  }

  const context = openAudioContext();

  if (context) {
    ensureResumed(context);
  }
}

export function useAudioUnlock() {
  useEffect(() => {
    const listening = new AbortController();
    const options = { capture: true, passive: true, signal: listening.signal };

    document.addEventListener("pointerdown", primeAudio, options); // Mouse clicks
    document.addEventListener("pointerup", primeAudio, options); // Touch taps
    document.addEventListener("keydown", primeAudioOnKeyDown, options);
    document.addEventListener("visibilitychange", resumeAudioOnReturn, { signal: listening.signal });

    return () => listening.abort();
  }, []);
}

/**
 * If the context is already running (once `primeAudio` has fired once this
 * session) this is synchronous. If it isn't—e.g. this is the very first
 * interaction—it resumes inline, which only works if this call is inside a
 * trusted user gesture, and plays once the context actually comes up.
 */
export function playSound(play: (context: AudioContext) => void) {
  if (getSettings().sound !== "on") {
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

  ensureResumed(context); // This may be inside a trusted gesture; it costs nothing otherwise.

  void whenAudioRunning(context).then(() => play(context));
}
