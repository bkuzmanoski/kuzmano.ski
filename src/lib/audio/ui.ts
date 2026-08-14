import { clamp } from "#/lib/math";

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

const SCROLL_DETENT_PIXELS = 12; // How far the content moves between detents.
const SCROLL_DETENT_FULL_SPEED = 2200; // The speed, in pixels per second, at which a detent is at full strength.
const SCROLL_DETENT_STEP_SPEED = 450; // The speed a step is credited with. A press is one notch however fast it repeats, so every press sounds alike.
const SCROLL_DETENT_LEVEL = { quiet: 0.3, loud: 0.45 };
const SCROLL_DETENT_RATE = { slow: 0.92, fast: 1.08 };
const SCROLL_DETENT_INTERVAL_MS = 0.018;
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

/** Sounds a click when the press event is disambiguated from a scroll. */
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

    if (at < lastDetentAt + SCROLL_DETENT_INTERVAL_MS) {
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

// Clamped scroll top position to prevent sound effects during overscroll.
function getScrollTop(element: Element) {
  return clamp(element.scrollTop, 0, element.scrollHeight - element.clientHeight);
}

// A gesture opens owing a full notch, so its first movement sounds a detent.
function openGesture(top: number, at: number): ScrollGesture {
  return { top, at, speed: 0, distance: SCROLL_DETENT_PIXELS };
}

export function playScroll(element: Element) {
  const now = performance.now();
  const top = getScrollTop(element);
  const gesture = gestures.get(element);

  if (!gesture) {
    gestures.set(element, openGesture(top, now));
    return;
  }

  const elapsed = now - gesture.at;
  const moved = Math.abs(top - gesture.top);

  /* A jump after a long pause is not a scroll gesture: it is a window opening
   * at a saved position, or content resizing under a fixed scroll offset. */
  if (elapsed > SCROLL_DETENT_IDLE_MS) {
    gestures.set(element, openGesture(top, now));
    return;
  }

  gesture.top = top;
  gesture.at = now;
  gesture.distance += moved;

  if (elapsed <= 0 || moved <= 0 || gesture.distance < SCROLL_DETENT_PIXELS) {
    return;
  }

  const speed = (moved / elapsed) * 1000;

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
  skipScrollAt(element);
  playScrollDetent(SCROLL_DETENT_STEP_SPEED);
}

/**
 * Moves the gesture of the viewport that is `element` to where its content now
 * sits, without sounding a detent. A window resize reflows the content under a
 * fixed viewport, so the scroll it produces is not a gesture; recording it here
 * stops the next real scroll from reading the jump as travel.
 */
export function skipScrollAt(element: Element) {
  gestures.set(element, openGesture(getScrollTop(element), performance.now()));
}

/**
 * Skips the scroll that bringing `element` into view has just made, for whichever
 * viewport above it moved. Both `focus` and `scrollIntoView` move their viewport
 * before they return, and only the scroll event that follows is asynchronous, so
 * reading the position here—between the two—records where the content has already
 * landed and leaves the jump silent.
 *
 * Only a viewport already holding a gesture is moved, since which ancestor scrolled
 * is not knowable from here. One that has yet to scroll holds none, and `playScroll`
 * opens it without sounding a detent, so there is nothing there to silence.
 */
export function skipScrollAbove(element: Element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (gestures.has(parent)) {
      skipScrollAt(parent);
    }
  }
}
