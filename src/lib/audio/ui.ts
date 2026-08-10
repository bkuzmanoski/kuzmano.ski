import { LEAD_TIME, playSound } from "./context";
import { playVoice } from "./voice";

import type { Voice } from "./voice";

const CLICK: Voice = {
  seconds: 0.015,
  seed: 0x5eed1e5,
  toneHz: 2000,
  toneQ: 1.2,
  dampingHz: 5000,
  attackSeconds: 0.0002,
  decaySeconds: 0.002,
  fadeSeconds: 0.002,
};

const DETENT: Voice = {
  seconds: 0.008,
  seed: 0xfee1e7,
  toneHz: 4200,
  toneQ: 0.9,
  dampingHz: 9000,
  attackSeconds: 0.0001,
  decaySeconds: 0.0012,
  fadeSeconds: 0.0015,
};

const HOVER_LEVEL = 0.22;
const HOVER_INTERVAL = 0.03;

const SCROLL_DETENT_PIXELS = 24; // How far the content moves between detents.
const SCROLL_DETENT_FULL_SPEED = 2200; // The speed, in pixels per second, at which a detent is at full strength.
const SCROLL_DETENT_STEP_SPEED = 450; // The speed a step is credited with. A press is one notch however fast it repeats, so every press sounds alike.
const SCROLL_DETENT_LEVEL = { quiet: 0.3, loud: 0.45 };
const SCROLL_DETENT_RATE = { slow: 0.92, fast: 1.08 };
const SCROLL_DETENT_INTERVAL = 0.018;
const SCROLL_DETENT_IDLE_MS = 250;
const SCROLL_DETENT_SPEED_SMOOTHING = 0.5;

let lastClickAt = 0;

export function playClick() {
  playSound((context) => {
    const at = Math.max(context.currentTime + LEAD_TIME, lastClickAt + CLICK.seconds);

    playVoice(context, CLICK, { at, level: 1, rate: 1 });
    lastClickAt = at;
  });
}

let lastHoverAt = 0;

export function playHover() {
  playSound((context) => {
    const at = context.currentTime + LEAD_TIME;

    if (at < lastHoverAt + HOVER_INTERVAL) {
      return;
    }

    playVoice(context, DETENT, { at, level: HOVER_LEVEL, rate: 1 });
    lastHoverAt = at;
  });
}

let lastDetentAt = 0;

function playScrollDetent(speed: number) {
  playSound((context) => {
    const at = context.currentTime + LEAD_TIME;

    if (at < lastDetentAt + SCROLL_DETENT_INTERVAL) {
      return;
    }

    const intensity = Math.sqrt(Math.min(1, speed / SCROLL_DETENT_FULL_SPEED));

    playVoice(context, DETENT, {
      at,
      level: SCROLL_DETENT_LEVEL.quiet + (SCROLL_DETENT_LEVEL.loud - SCROLL_DETENT_LEVEL.quiet) * intensity,
      rate: SCROLL_DETENT_RATE.slow + (SCROLL_DETENT_RATE.fast - SCROLL_DETENT_RATE.slow) * intensity,
    });

    lastDetentAt = at;
  });
}

interface ScrollGesture {
  top: number;
  at: number;
  speed: number;
  distance: number;
}

const gestures = new WeakMap<Element, ScrollGesture>(); // Per element, so two windows scrolling at once each keep their own place.

export function playScroll(element: Element) {
  const now = performance.now();
  const top = element.scrollTop;
  const gesture = gestures.get(element);

  if (!gesture) {
    gestures.set(element, { top, at: now, speed: 0, distance: 0 });
    return;
  }

  const elapsed = now - gesture.at;
  const moved = Math.abs(top - gesture.top);

  gesture.top = top;
  gesture.at = now;

  /* A jump after a long pause is not a scroll gesture: it is a window opening
   * at a saved position, or content resizing under a fixed scroll offset. */
  if (elapsed > SCROLL_DETENT_IDLE_MS) {
    gesture.speed = 0;
    gesture.distance = 0;

    return;
  }

  gesture.distance += moved;

  /* Two events inside the same clock tick tell us nothing about speed, and one that
   * moved nothing vertically—a sibling axis scrolling, say—is not travel at all. */
  if (elapsed <= 0 || moved <= 0 || gesture.distance < SCROLL_DETENT_PIXELS) {
    return;
  }

  const speed = (moved / elapsed) * 1000;

  /* The opening sample of a gesture has nothing to blend with: smoothing it against a
   * standing start would halve the detent that every gesture begins on. */
  gesture.speed =
    gesture.speed > 0
      ? gesture.speed * SCROLL_DETENT_SPEED_SMOOTHING + speed * (1 - SCROLL_DETENT_SPEED_SMOOTHING)
      : speed;

  /* Keep the leftover travel, so notches stay evenly spaced however the browser
   * happens to chunk the movement, but never bank more than one notch of debt
   * from a fling. */
  gesture.distance = Math.min(gesture.distance - SCROLL_DETENT_PIXELS, SCROLL_DETENT_PIXELS);

  playScrollDetent(gesture.speed);
}

export function playScrollStep(element: Element) {
  skipScroll(element);
  playScrollDetent(SCROLL_DETENT_STEP_SPEED);
}

/**
 * Moves the gesture to where the content now sits without sounding a detent. A
 * window resize reflows the content under a fixed viewport, so the scroll it
 * produces is not a gesture; recording it here stops the next real scroll from
 * reading the jump as travel.
 */
export function skipScroll(element: Element) {
  gestures.set(element, { top: element.scrollTop, at: performance.now(), speed: 0, distance: 0 });
}
