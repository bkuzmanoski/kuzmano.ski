import { clamp } from "../math.ts";

import { playClickSound, playScrollDetentSound } from "./sounds.ts";

export const IDLE_DURATION_MS = 250;
export const DETENT_PX = 40; // Content distance between detents.

const STEP_SPEED_PX_PER_S = 450;
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
  return { top, at, speed: 0, distance: DETENT_PX, silent };
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

export function playScrollStepSound(element: Element) {
  recordScrollAt(element);
  playScrollDetentSound(STEP_SPEED_PX_PER_S);
}

/** Scrolls `element` by `delta` and reports whether the viewport moved. */
export function stepScroll(element: Element, delta: number) {
  const initialScrollTop = element.scrollTop;

  element.scrollBy({ top: delta, behavior: "instant" });

  if (element.scrollTop === initialScrollTop) {
    return false;
  }

  playScrollStepSound(element);

  return true;
}

/**
 * Scrolls `element` by `delta` for one press of a control that steps it, such as a scrollbar
 * arrow or an arrow key, and plays that press's sound.
 */
export function stepScrollForPress(element: Element, delta: number, isRepeat: boolean) {
  if (!stepScroll(element, delta) && !isRepeat) {
    playClickSound();
  }
}

export function playScrollSound(element: Element) {
  const now = performance.now();
  const top = getScrollTop(element);
  const gesture = gestures.get(element);

  if (!gesture) {
    gestures.set(element, openGesture(top, now));
    return;
  }

  const elapsedMs = now - gesture.at;
  const movedDistance = Math.abs(top - gesture.top);

  // A long pause starts a new gesture, so saved positions and layout changes
  // do not inherit the previous gesture's accumulated distance.
  if (elapsedMs > IDLE_DURATION_MS) {
    gestures.set(element, openGesture(top, now));
    return;
  }

  gesture.top = top;
  gesture.at = now;

  if (gesture.silent) {
    return;
  }

  gesture.distance += movedDistance;

  if (elapsedMs <= 0 || movedDistance <= 0 || gesture.distance < DETENT_PX) {
    return;
  }

  const speed = (movedDistance / elapsedMs) * 1000;

  gesture.speed = gesture.speed > 0 ? gesture.speed * SPEED_SMOOTHING + speed * (1 - SPEED_SMOOTHING) : speed;

  // Keep the remainder so detents stay evenly spaced across event boundaries,
  // but never carry more than one detent into the next event.
  gesture.distance = Math.min(gesture.distance - DETENT_PX, DETENT_PX);

  playScrollDetentSound(gesture.speed);
}

// Records `height` and reports whether it differs from the element's previous height in `heights`.
function recordHeight(element: Element, heights: WeakMap<Element, number>, height: number) {
  const previousHeight = heights.get(element);

  heights.set(element, height);

  return previousHeight !== undefined && previousHeight !== height;
}

// Plays a scroll sound unless the caller found that the element's size changed since its previous scroll.
//
// A size change identifies a scroll caused by layout rather than user input. Such scrolls are recorded
// without a sound. The caller supplies the result because the relevant measurements differ by context.
function playScrollSoundUnlessResized(element: Element, isResized: boolean) {
  if (isResized) {
    recordScrollAt(element);
    return;
  }

  playScrollSound(element);
}

/**
 * Plays a sound for user scrolling in a viewport with resizable dimensions and content.
 *
 * Viewport resizing, content changes, scroll anchoring, and clamping can all move the viewport
 * without user input. When a scroll event follows a change to `clientHeight` or `scrollHeight`, it
 * is treated as layout-driven and recorded without playing a sound.
 */
export function playPaneScrollSound(element: Element) {
  const isViewportResized = recordHeight(element, viewportHeights, element.clientHeight);
  const isContentResized = recordHeight(element, contentHeights, element.scrollHeight);

  playScrollSoundUnlessResized(element, isViewportResized || isContentResized);
}

/**
 * Plays a sound for user scrolling in an input whose content can also change size.
 *
 * Editing can change the content height and cause the browser to scroll the caret into view.
 * The resulting scroll event occurs after the edit, with a different `scrollHeight`, allowing
 * it to be identified as layout-driven and recorded without a sound.
 */
export function playInputScrollSound(element: Element) {
  playScrollSoundUnlessResized(element, recordHeight(element, contentHeights, element.scrollHeight));
}
