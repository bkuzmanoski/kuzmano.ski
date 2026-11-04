import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

/** The longest a click can take to arrive after the press it belongs to. */
export const MAX_CLICK_DELAY_MS = 1_000;

let stopSwallowing: (() => void) | null = null;

export function isPrimaryPress(event: ReactMouseEvent | MouseEvent): boolean {
  return event.button === 0;
}

/**
 * Whether a click has the `detail` and `pointerType` of a press with a pointing device. For a screen reader's activate
 * action, Safari dispatches a `click` with a `detail` of `0`. Firefox dispatches `mousedown`, `mouseup`, and a `click`
 * with a `detail` of `1`, and only the empty `pointerType` of that `click` separates it from a press. React does not
 * copy `pointerType` to its `click` event.
 *
 * Returns `true` for the `click` of the press Chrome simulates for that action, which only `isSimulatedMouseDown`
 * identifies.
 */
export function isPointerClick(event: ReactMouseEvent | MouseEvent): boolean {
  const nativeEvent = "nativeEvent" in event ? event.nativeEvent : event;
  return event.detail > 0 && (nativeEvent as PointerEvent).pointerType !== "";
}

/**
 * Whether a click repeats one the browser has already acted on (e.g., the second of a double click). `detail` contains
 * the running count of the sequence.
 */
export function isRepeatClick(event: ReactMouseEvent | MouseEvent): boolean {
  return event.detail > 1;
}

/**
 * Whether a `mousedown` belongs to a press simulated by a screen reader's activate action in Chrome. Chrome dispatches
 * the pointer and mouse events of a press for that action, and sets `detail` only on the `click`. The `mousedown` of a
 * press from an input device has its click count in `detail`.
 */
export function isSimulatedMouseDown(event: ReactMouseEvent | MouseEvent): boolean {
  return event.detail === 0;
}

/**
 * Releases the pointer capture the browser implicitly sets on the element a touch lands on, so the pointer can reach
 * other elements while the finger stays down.
 */
export function releaseImplicitPointerCapture({ currentTarget, pointerId }: ReactPointerEvent<Element>): void {
  if (currentTarget.hasPointerCapture(pointerId)) {
    currentTarget.releasePointerCapture(pointerId);
  }
}

/**
 * Swallows the rest of the current press, including its focus change, click, and double click.
 *
 * Normalizes touch and mouse handling. The browser resolves the click target of a touch when it ends, and that of a
 * mouse press when it begins.
 */
export function swallowNextPress(): void {
  stopSwallowing?.();

  const clickController = new AbortController();
  const pressController = new AbortController();

  function swallowFocus(event: MouseEvent) {
    event.preventDefault();
  }

  function swallowEvent(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function swallowClick(event: MouseEvent) {
    swallowEvent(event);
    clickController.abort();

    // Leaves the `dblclick` listener in place as the browser dispatches `dblclick` after `click`. The `pointerdown` of
    // the next press removes it.
  }

  function abandon() {
    stopSwallowing?.();
  }

  const abandonTimer = setTimeout(abandon, MAX_CLICK_DELAY_MS);

  document.addEventListener("mousedown", swallowFocus, { capture: true, signal: clickController.signal });
  document.addEventListener("click", swallowClick, { capture: true, signal: clickController.signal });
  document.addEventListener("dblclick", swallowEvent, { capture: true, signal: pressController.signal });
  document.addEventListener("pointerdown", abandon, { capture: true, signal: pressController.signal });

  stopSwallowing = () => {
    stopSwallowing = null;

    clearTimeout(abandonTimer);
    clickController.abort();
    pressController.abort();
  };
}
