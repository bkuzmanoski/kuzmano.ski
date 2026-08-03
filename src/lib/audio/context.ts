import { useEffect } from "react";

import { getSettings } from "../settings";

/* Web Audio runs on its own thread and renders ahead of `currentTime`, so anything
 * scheduled at `currentTime` is partly in the past by the time it is rendered. */
export const LEAD_TIME = 0.02;

const OUTPUT_GAIN = 0.2;

let audioContext: AudioContext | null = null;
let output: GainNode | null = null;
let unlocking: Promise<void> | null = null;

function getAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }

  const Constructor = typeof window === "undefined" ? undefined : window.AudioContext;

  if (!Constructor) {
    return null;
  }

  audioContext = new Constructor({ latencyHint: "interactive" });

  return audioContext;
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

  const context = getAudioContext();

  if (!context || context.state === "running" || unlocking) {
    return;
  }

  unlocking = context
    .resume()
    .catch(() => {
      // Ignored.
    })
    .finally(() => {
      unlocking = null;
    });
}

export function useAudioUnlock() {
  useEffect(() => {
    document.addEventListener("pointerdown", unlockAudio, { capture: true, passive: true });
    document.addEventListener("keydown", unlockAudio, { capture: true, passive: true });
    document.addEventListener("visibilitychange", unlockAudio);

    return () => {
      document.removeEventListener("pointerdown", unlockAudio, true);
      document.removeEventListener("keydown", unlockAudio, true);
      document.removeEventListener("visibilitychange", unlockAudio);
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

  const context = getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "running") {
    play(context);
    return;
  }

  void context
    .resume()
    .then(() => play(context))
    .catch(() => {
      // Ignored.
    });
}
