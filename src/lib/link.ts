import type { MouseEvent as ReactMouseEvent } from "react";

/**
 * Whether a click repeats one the browser has already acted on (e.g., the second of a double
 * click). `detail` contains the running count of the sequence.
 */
export function isRepeatClick(event: ReactMouseEvent | MouseEvent): boolean {
  return event.detail > 1;
}

/**
 * Whether a click on a link requires the browser's own handling of the href (e.g.
 * opening in a new tab or window, or downloading the resource).
 */
export function isBrowserHandledClick(event: ReactMouseEvent | MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/** Follows a link from code, for UI that defers activation past the original click. */
export function followLink(element: HTMLAnchorElement | null | undefined) {
  if (!element) {
    return;
  }

  element.dataset.following = "";

  try {
    element.click();
  } finally {
    delete element.dataset.following;
  }
}

/**
 * Whether the click being handled on an element originated from `followLink` rather than
 * from the user. A handler that suppresses the user's own clicks has to let this one
 * through, or the deferred navigation never happens.
 */
export function isFollowingLink(element: HTMLElement): boolean {
  return element.dataset.following !== undefined;
}
