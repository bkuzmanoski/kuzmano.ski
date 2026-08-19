import type { MouseEvent as ReactMouseEvent } from "react";

/**
 * Whether a click repeats one the browser has already acted on (e.g., the second of a double
 * click). `detail` carries the running count of the sequence.
 */
export function isRepeatClick(event: ReactMouseEvent | MouseEvent): boolean {
  return event.detail > 1;
}

/**
 * Whether a click on a link is asking for the browser's own handling of the href (e.g.
 * opening in a new tab or window, or downloading the resource).
 */
export function isBrowserHandledClick(event: ReactMouseEvent | MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * Follows a link from code, for UI that defers activation past the click that asked for
 * it: a menu item that plays a highlight animation first, or a desktop icon that opens
 * on the second click of a double click. Both suppress the anchor's own click, so the
 * navigation has to be performed here once the deferred work is done.
 *
 * The element carries a mark for the length of the click, so the handler that suppresses
 * the user's own clicks can tell this one apart. `click()` dispatches synchronously, so
 * the mark is set and cleared within this call.
 */
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
 * through, or the navigation it was asked to make never happens.
 */
export function isFollowingLink(element: HTMLElement): boolean {
  return element.dataset.following !== undefined;
}
