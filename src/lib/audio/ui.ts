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
  seconds: 0.01,
  seed: 0x0de7e47,
  toneHz: 3000,
  toneQ: 1.6,
  dampingHz: 7000,
  attackSeconds: 0.0001,
  decaySeconds: 0.001,
  fadeSeconds: 0.0015,
};

let lastClickAt = 0;

export function playClick() {
  playSound((context) => {
    const at = Math.max(context.currentTime + LEAD_TIME, lastClickAt + CLICK.seconds);

    playVoice(context, CLICK, { at, level: 1, rate: 1 });
    lastClickAt = at;
  });
}

const DETENT_PIXELS = 24; // How far the content moves between detents.
const DETENT_FULL_SPEED = 2200; // The speed, in pixels per second, at which a detent is at full strength.
const DETENT_STEP_SPEED = 450; // The speed a step is credited with. A press is one notch however fast it repeats, so every press sounds alike.
const DETENT_LEVEL = { quiet: 0.3, loud: 0.6 };
const DETENT_RATE = { slow: 0.9, fast: 1.1 };
const DETENT_INTERVAL = 0.01;
const DETENT_IDLE_MS = 250;
const DETENT_SPEED_SMOOTHING = 0.5;

let lastDetentAt = 0;

function playDetent(speed: number) {
  playSound((context) => {
    const at = context.currentTime + LEAD_TIME;

    if (at < lastDetentAt + DETENT_INTERVAL) {
      return;
    }

    const intensity = Math.sqrt(Math.min(1, speed / DETENT_FULL_SPEED));

    playVoice(context, DETENT, {
      at,
      level: DETENT_LEVEL.quiet + (DETENT_LEVEL.loud - DETENT_LEVEL.quiet) * intensity,
      rate: DETENT_RATE.slow + (DETENT_RATE.fast - DETENT_RATE.slow) * intensity,
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

/** Sounds the detents earned by a wheel or a trackpad, which report travel continuously. */
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
  if (elapsed > DETENT_IDLE_MS) {
    gesture.speed = 0;
    gesture.distance = 0;

    return;
  }

  gesture.distance += moved;

  /* Two events inside the same clock tick tell us nothing about speed, and one that
   * moved nothing vertically—a sibling axis scrolling, say—is not travel at all. */
  if (elapsed <= 0 || moved <= 0 || gesture.distance < DETENT_PIXELS) {
    return;
  }

  const speed = (moved / elapsed) * 1000;

  /* The opening sample of a gesture has nothing to blend with: smoothing it against a
   * standing start would halve the detent that every gesture begins on. */
  gesture.speed =
    gesture.speed > 0 ? gesture.speed * DETENT_SPEED_SMOOTHING + speed * (1 - DETENT_SPEED_SMOOTHING) : speed;

  /* Keep the leftover travel, so notches stay evenly spaced however the browser
   * happens to chunk the movement, but never bank more than one notch of debt
   * from a fling. */
  gesture.distance = Math.min(gesture.distance - DETENT_PIXELS, DETENT_PIXELS);

  playDetent(gesture.speed);
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

/**
 * Sounds the one detent a scrollbar step earns. A press is a discrete notch rather than
 * travel to be measured—the accumulator and the speed estimate above are there for
 * wheels and trackpads—so it is sounded outright, and the scroll it raises is skipped so
 * that the notch is not sounded twice.
 */
export function playScrollStep(element: Element) {
  skipScroll(element);
  playDetent(DETENT_STEP_SPEED);
}
