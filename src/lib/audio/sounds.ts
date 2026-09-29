import keyDownRecordingUrl from "#/assets/sounds/key-down.wav";
import keyUpRecordingUrl from "#/assets/sounds/key-up.wav";

import { LEAD_TIME_S, schedulePlayback } from "./context.ts";
import { loadRecording, playRecording } from "./recording.ts";
import { playStrike } from "./strike.ts";
import { playTone } from "./tone.ts";

import type { Strike } from "./strike.ts";
import type { Tone } from "./tone.ts";

const CLICK: Strike = {
  durationSeconds: 0.015,
  seed: 0x5eed1e5,
  toneHz: 3000,
  toneQ: 1.2,
  dampingHz: 5000,
  attackSeconds: 0.0002,
  decaySeconds: 0.002,
  fadeSeconds: 0.002,
};

// Shared by hover and the scroll detents.
const DETENT: Strike = {
  durationSeconds: 0.01,
  seed: 0xfee1e7,
  toneHz: 7000,
  toneQ: 1.0,
  dampingHz: 9000,
  attackSeconds: 0.0001,
  decaySeconds: 0.0012,
  fadeSeconds: 0.0015,
};

const BOOT_CHIME: Tone = {
  notes: [{ hz: 440, seconds: 1.2 }],
  partials: 6,
  partialDecay: 0.5,
  attackSeconds: 0.004,
  decaySeconds: 0.55,
  fadeSeconds: 0.06,
};

const ERROR: Tone = {
  notes: [{ hz: 587.33, seconds: 0.2 }], // D5.
  partials: 4,
  partialDecay: 0.6,
  attackSeconds: 0.002,
  decaySeconds: 0.14,
  fadeSeconds: 0.02,
};

const SUCCESS: Tone = {
  notes: [
    { hz: 659.25, seconds: 0.06 }, // E5.
    { hz: 987.77, seconds: 0.14 }, // B5.
  ],
  partials: 3,
  partialDecay: 0.5,
  attackSeconds: 0.002,
  decaySeconds: 0.12,
  fadeSeconds: 0.02,
};

const HOVER_INTERVAL_S = 0.03;
const HOVER_LEVEL = 0.2;

const SCROLL_DETENT_INTERVAL_S = 0.03;
const SCROLL_DETENT_FULL_SPEED_PX_PER_S = 2000; // The speed, in pixels per second, at which a detent is at full strength.
const SCROLL_DETENT_LEVEL = { quiet: 0.1, loud: 0.2 };
const SCROLL_DETENT_RATE = { slow: 1.0, fast: 1.05 };

const KEY_LEVEL = 1.25;
const KEY_UP_MIN_DELAY_S = 0.04; // Ensures key up follows key down, even when both wait for the same audio resume.
const KEY_UP_TAP_DELAY_S = 0.1175; // Timing of the key-up sound within the original keypress recording.

const BOOT_CHIME_LEVEL = 0.5;
const ERROR_LEVEL = 0.5;
const SUCCESS_LEVEL = 0.4;

let lastClickAt = 0;

export function playClickSound() {
  schedulePlayback((context) => {
    const at = Math.max(context.currentTime + LEAD_TIME_S, lastClickAt + CLICK.durationSeconds);

    playStrike(context, CLICK, { at, level: 1, rate: 1 });
    lastClickAt = at;
  });
}

let lastHoverAt = 0;

export function playHoverSound() {
  schedulePlayback((context) => {
    const at = context.currentTime + LEAD_TIME_S;

    if (at < lastHoverAt + HOVER_INTERVAL_S) {
      return;
    }

    playStrike(context, DETENT, { at, level: HOVER_LEVEL, rate: 1 });
    lastHoverAt = at;
  });
}

let lastDetentAt = 0;

export function playScrollDetentSound(speed: number) {
  schedulePlayback((context) => {
    const at = context.currentTime + LEAD_TIME_S;

    if (at < lastDetentAt + SCROLL_DETENT_INTERVAL_S) {
      return;
    }

    const intensity = Math.sqrt(Math.min(1, speed / SCROLL_DETENT_FULL_SPEED_PX_PER_S));

    playStrike(context, DETENT, {
      at,
      level: SCROLL_DETENT_LEVEL.quiet + (SCROLL_DETENT_LEVEL.loud - SCROLL_DETENT_LEVEL.quiet) * intensity,
      rate: SCROLL_DETENT_RATE.slow + (SCROLL_DETENT_RATE.fast - SCROLL_DETENT_RATE.slow) * intensity,
    });

    lastDetentAt = at;
  });
}

export function loadKeySounds(): Promise<unknown> {
  return Promise.all([loadRecording(keyDownRecordingUrl), loadRecording(keyUpRecordingUrl)]);
}

let lastKeyDownAt = 0;

export function playKeyDownSound() {
  schedulePlayback((context) => {
    const at = context.currentTime + LEAD_TIME_S;

    playRecording(context, keyDownRecordingUrl, { at, level: KEY_LEVEL });
    lastKeyDownAt = at;
  });
}

export function playKeyUpSound() {
  schedulePlayback((context) => {
    const at = Math.max(context.currentTime + LEAD_TIME_S, lastKeyDownAt + KEY_UP_MIN_DELAY_S);

    playRecording(context, keyUpRecordingUrl, { at, level: KEY_LEVEL });
  });
}

export function playKeyPressSound() {
  schedulePlayback((context) => {
    const at = context.currentTime + LEAD_TIME_S;

    playRecording(context, keyDownRecordingUrl, { at, level: KEY_LEVEL });
    playRecording(context, keyUpRecordingUrl, { at: at + KEY_UP_TAP_DELAY_S, level: KEY_LEVEL });
  });
}

export function playBootChimeSound({ delaySeconds }: { delaySeconds: number }) {
  schedulePlayback((context) =>
    playTone(context, BOOT_CHIME, { at: context.currentTime + LEAD_TIME_S + delaySeconds, level: BOOT_CHIME_LEVEL }),
  );
}

export function playErrorSound() {
  schedulePlayback((context) =>
    playTone(context, ERROR, { at: context.currentTime + LEAD_TIME_S, level: ERROR_LEVEL }),
  );
}

export function playSuccessSound() {
  schedulePlayback((context) =>
    playTone(context, SUCCESS, { at: context.currentTime + LEAD_TIME_S, level: SUCCESS_LEVEL }),
  );
}
