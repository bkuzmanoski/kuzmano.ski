import { LEAD_TIME, playSound } from "./context";
import { playStrike } from "./strike";
import { playTone } from "./tone";

import type { Strike } from "./strike";
import type { Tone } from "./tone";

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
const HOVER_LEVEL = 0.22;

const SCROLL_DETENT_INTERVAL_S = 0.03;
const SCROLL_DETENT_FULL_SPEED = 2000; // The speed, in pixels per second, at which a detent is at full strength.
const SCROLL_DETENT_LEVEL = { quiet: 0.1, loud: 0.3 };
const SCROLL_DETENT_RATE = { slow: 1.0, fast: 1.05 };

const BOOT_CHIME_LEVEL = 0.5;
const ERROR_LEVEL = 0.5;
const SUCCESS_LEVEL = 0.4;

let lastClickAt = 0;

export function playClick() {
  playSound((context) => {
    const at = Math.max(context.currentTime + LEAD_TIME, lastClickAt + CLICK.durationSeconds);

    playStrike(context, CLICK, { at, level: 1, rate: 1 });
    lastClickAt = at;
  });
}

let lastHoverAt = 0;

export function playHover() {
  playSound((context) => {
    const at = context.currentTime + LEAD_TIME;

    if (at < lastHoverAt + HOVER_INTERVAL_S) {
      return;
    }

    playStrike(context, DETENT, { at, level: HOVER_LEVEL, rate: 1 });
    lastHoverAt = at;
  });
}

let lastDetentAt = 0;

export function playScrollDetent(speed: number) {
  playSound((context) => {
    const at = context.currentTime + LEAD_TIME;

    if (at < lastDetentAt + SCROLL_DETENT_INTERVAL_S) {
      return;
    }

    const intensity = Math.sqrt(Math.min(1, speed / SCROLL_DETENT_FULL_SPEED));

    playStrike(context, DETENT, {
      at,
      level: SCROLL_DETENT_LEVEL.quiet + (SCROLL_DETENT_LEVEL.loud - SCROLL_DETENT_LEVEL.quiet) * intensity,
      rate: SCROLL_DETENT_RATE.slow + (SCROLL_DETENT_RATE.fast - SCROLL_DETENT_RATE.slow) * intensity,
    });

    lastDetentAt = at;
  });
}

/** The startup chime, scheduled ahead to synchronize with the animation timing. */
export function playBootChime({ delaySeconds }: { delaySeconds: number }) {
  playSound((context) =>
    playTone(context, BOOT_CHIME, { at: context.currentTime + LEAD_TIME + delaySeconds, level: BOOT_CHIME_LEVEL }),
  );
}

export function playError() {
  playSound((context) => playTone(context, ERROR, { at: context.currentTime + LEAD_TIME, level: ERROR_LEVEL }));
}

export function playSuccess() {
  playSound((context) => playTone(context, SUCCESS, { at: context.currentTime + LEAD_TIME, level: SUCCESS_LEVEL }));
}

/**
 * Sounds a click only when a press does not become a scroll.
 *
 * A touch press may still become one, so the click waits for the release. If the browser
 * takes the gesture for panning, it fires `pointercancel` instead of `pointerup`, so the
 * click is never played. Mouse and pen presses cannot become a scroll, so they sound on
 * the way down.
 */
export const scrollSafeClickSoundHandlers = {
  onPointerDown: ({ pointerType }: { pointerType: string }) => {
    if (pointerType !== "touch") {
      playClick();
    }
  },
  onPointerUp: ({ pointerType }: { pointerType: string }) => {
    if (pointerType === "touch") {
      playClick();
    }
  },
};
