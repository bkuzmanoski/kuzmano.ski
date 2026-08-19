import type { MouseEvent } from "react";

/**
 * Whether a click on a link is asking for the browser's own handling of the href (e.g.
 * opening in a new tab or window, or downloading the resource).
 */
export function isBrowserHandledClick(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
