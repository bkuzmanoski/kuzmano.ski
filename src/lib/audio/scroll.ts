import { clamp } from "#/lib/math";

import { playScrollDetent } from "./sounds";

export const IDLE_MS = 250;
export const DETENT_PIXELS = 12; // Content distance between detents.
const STEP_SPEED = 450; // Fixed speed for keyboard/menu scroll steps.
const SPEED_SMOOTHING = 0.5;

interface ScrollGesture {
  top: number;
  at: number;
  speed: number;
  distance: number;
}

const gestures = new WeakMap<Element, ScrollGesture>();
const contentHeights = new WeakMap<Element, number>();

// Ignore overscroll so it cannot produce detents.
function getScrollTop(element: Element) {
  return clamp(element.scrollTop, 0, element.scrollHeight - element.clientHeight);
}

// Start with a full detent so the first real movement sounds immediately.
function openGesture(top: number, at: number): ScrollGesture {
  return { top, at, speed: 0, distance: DETENT_PIXELS };
}

/**
 * Records the current position without playing a detent.
 *
 * Use this when layout moves the viewport rather than the user scrolling it.
 */
export function skipScrollAt(element: Element) {
  gestures.set(element, openGesture(getScrollTop(element), performance.now()));
}

/**
 * Records the scroll caused by bringing `element` into view without playing it.
 *
 * `focus` and `scrollIntoView` update the viewport before returning, while the
 * resulting scroll event is asynchronous. Recording the position here prevents
 * that jump from being mistaken for user scrolling.
 */
export function skipScrollAbove(element: Element) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (gestures.has(parent)) {
      skipScrollAt(parent);
    }
  }
}

/**
 * Scrolls `element` by `delta` and reports whether the viewport moved.
 *
 * A step at the end of the travel moves nothing and so makes no sound, which is why the
 * result is returned: the control that asked for the step is left to sound on its own.
 */
export function stepScroll(element: Element, delta: number) {
  const initialScrollTop = element.scrollTop;

  element.scrollBy({ top: delta });

  if (element.scrollTop === initialScrollTop) {
    return false;
  }

  playScrollStep(element);

  return true;
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

  // A long pause starts a new gesture, so saved positions and layout changes
  // do not inherit the previous gesture's accumulated distance.
  if (elapsed > IDLE_MS) {
    gestures.set(element, openGesture(top, now));
    return;
  }

  gesture.top = top;
  gesture.at = now;
  gesture.distance += moved;

  if (elapsed <= 0 || moved <= 0 || gesture.distance < DETENT_PIXELS) {
    return;
  }

  const speed = (moved / elapsed) * 1000;

  gesture.speed = gesture.speed > 0 ? gesture.speed * SPEED_SMOOTHING + speed * (1 - SPEED_SMOOTHING) : speed;

  // Keep the remainder so detents stay evenly spaced across event boundaries,
  // but never carry more than one detent into the next event.
  gesture.distance = Math.min(gesture.distance - DETENT_PIXELS, DETENT_PIXELS);

  playScrollDetent(gesture.speed);
}

export function playScrollStep(element: Element) {
  skipScrollAt(element);
  playScrollDetent(STEP_SPEED);
}

/**
 * Plays a sound for scrolling a field whose content grows and shrinks as it is edited.
 *
 * An edit that changes the wrapped height scrolls the caret back into view, which arrives
 * as an ordinary scroll event. `skipScrollAt` cannot be called ahead of it as it can for
 * `focus` or `scrollIntoView`: the browser scrolls the field while laying it out, after
 * the edit's effects have already run. The change in content height identifies such a
 * scroll, so it is recorded here instead.
 */
export function playFieldScroll(element: Element) {
  const contentHeight = contentHeights.get(element);

  contentHeights.set(element, element.scrollHeight);

  if (contentHeight !== undefined && contentHeight !== element.scrollHeight) {
    skipScrollAt(element);
    return;
  }

  playScroll(element);
}
