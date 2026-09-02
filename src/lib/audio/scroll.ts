import { clamp } from "#/lib/math";

import { playScrollDetent } from "./sounds";

export const IDLE_DURATION_MS = 250;
export const DETENT_PIXELS = 40; // Content distance between detents.

const STEP_SPEED = 450;
const SPEED_SMOOTHING = 0;

interface ScrollGesture {
  top: number;
  at: number;
  speed: number;
  distance: number;
  silent: boolean;
}

const gestures = new WeakMap<Element, ScrollGesture>();
const viewportHeights = new WeakMap<Element, number>();
const contentHeights = new WeakMap<Element, number>();

// Ignore overscroll so it cannot produce detents.
function getScrollTop(element: Element) {
  return clamp(element.scrollTop, 0, element.scrollHeight - element.clientHeight);
}

// Start with a full detent so the first real movement plays a sound immediately.
function openGesture(top: number, at: number, silent = false): ScrollGesture {
  return { top, at, speed: 0, distance: DETENT_PIXELS, silent };
}

/** Records the current position without playing a detent. */
export function recordScrollAt(element: Element) {
  gestures.set(element, openGesture(getScrollTop(element), performance.now()));
}

/** Silences an element's scrolling until it settles. */
export function silenceScrollAt(element: Element) {
  gestures.set(element, openGesture(getScrollTop(element), performance.now(), true));
}

function forEachScrollingAncestor(element: Element, apply: (parent: Element) => void) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (gestures.has(parent)) {
      apply(parent);
    }
  }
}

/** Records every scrolling ancestor after a scroll caused by the page, without playing detents. */
export function recordScrollIntoView(element: Element) {
  forEachScrollingAncestor(element, recordScrollAt);
}

/**
 * Silences every scrolling ancestor while the browser brings `element` into view.
 *
 * Safari animates this scroll, so it produces a series of scroll events rather than
 * a single completed move.
 */
export function silenceScrollIntoView(element: Element) {
  forEachScrollingAncestor(element, silenceScrollAt);
}

/** Brings `element` into view without playing a sound for the scroll it causes. */
export function scrollIntoViewSilently(element: Element, options?: Omit<ScrollIntoViewOptions, "behavior">) {
  element.scrollIntoView({ block: "nearest", ...options, behavior: "instant" });
  recordScrollIntoView(element);
}

export function playScrollStep(element: Element) {
  recordScrollAt(element);
  playScrollDetent(STEP_SPEED);
}

/** Scrolls `element` by `delta` and reports whether the viewport moved. */
export function stepScroll(element: Element, delta: number) {
  const initialScrollTop = element.scrollTop;

  element.scrollBy({ top: delta, behavior: "instant" });

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
  if (elapsed > IDLE_DURATION_MS) {
    gestures.set(element, openGesture(top, now));
    return;
  }

  gesture.top = top;
  gesture.at = now;

  if (gesture.silent) {
    return;
  }

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

/**
 * Plays a scroll sound unless the element's height changed since its previous scroll.
 *
 * A height change identifies a scroll caused by layout rather than user input. Such scrolls
 * are recorded without a sound. The caller supplies the height because the relevant
 * measurement differs by context.
 */
function playScrollUnlessResized(element: Element, heights: WeakMap<Element, number>, height: number) {
  const previousHeight = heights.get(element);

  heights.set(element, height);

  if (previousHeight !== undefined && previousHeight !== height) {
    recordScrollAt(element);
    return;
  }

  playScroll(element);
}

/**
 * Plays a sound for user scrolling in a viewport that can also be resized.
 *
 * Resizing a viewport can change its scroll position, particularly when it becomes shorter.
 * The resulting scroll event occurs after the resize, with a different `clientHeight`, allowing
 * it to be identified as layout-driven and recorded without a sound.
 */
export function playPaneScroll(element: Element) {
  playScrollUnlessResized(element, viewportHeights, element.clientHeight);
}

/**
 * Plays a sound for user scrolling in an input whose content can also change size.
 *
 * Editing can change the content height and cause the browser to scroll the caret into view.
 * The resulting scroll event occurs after the edit, with a different `scrollHeight`, allowing
 * it to be identified as layout-driven and recorded without a sound.
 */
export function playInputScroll(element: Element) {
  playScrollUnlessResized(element, contentHeights, element.scrollHeight);
}
