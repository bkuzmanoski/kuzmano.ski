import { isApplePlatform } from "../device.ts";

/** The fields of a `keydown` event `keyboardScrollDelta` reads. */
export interface ScrollKeyEvent {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

const APPLE_OPTION_ARROW_SCROLL_KEYS: Record<string, string> = { ArrowUp: "PageUp", ArrowDown: "PageDown" };
const APPLE_COMMAND_ARROW_SCROLL_KEYS: Record<string, string> = { ArrowUp: "Home", ArrowDown: "End" };

/**
 * Returns the scroll action represented by a key press, or `null` when modifiers prevent scrolling. On Apple platforms,
 * Option+Arrow keys page and Command+Arrow keys jump to an end.
 */
function scrollKeyOf(event: ScrollKeyEvent): string | null {
  if (!event.altKey && !event.ctrlKey && !event.metaKey) {
    return event.key;
  }

  if (!isApplePlatform() || event.ctrlKey || (event.altKey && event.metaKey)) {
    return null;
  }

  return (event.altKey ? APPLE_OPTION_ARROW_SCROLL_KEYS : APPLE_COMMAND_ARROW_SCROLL_KEYS)[event.key] ?? null;
}

/** Returns the viewport scroll distance for a key press, or `null` if the key does not scroll. */
export function keyboardScrollDelta(
  event: ScrollKeyEvent,
  viewport: Pick<HTMLElement, "clientHeight" | "scrollHeight">,
  arrowStepPx: number,
): number | null {
  const pageDistance = () => Math.max(viewport.clientHeight - arrowStepPx, arrowStepPx);

  switch (scrollKeyOf(event)) {
    case "ArrowUp":
      return -arrowStepPx;

    case "ArrowDown":
      return arrowStepPx;

    case "PageUp":
      return -pageDistance();

    case "PageDown":
      return pageDistance();

    case " ":
      return event.shiftKey ? -pageDistance() : pageDistance();

    case "Home":
      return -viewport.scrollHeight;

    case "End":
      return viewport.scrollHeight;

    default:
      return null;
  }
}
