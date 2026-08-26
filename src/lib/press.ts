import type { MouseEvent as ReactMouseEvent } from "react";

/** The longest a click can take to arrive after the press it belongs to. */
export const MAX_CLICK_DELAY_MS = 1_000;

let standDown: (() => void) | null = null;

export function isPrimaryPress(event: ReactMouseEvent | MouseEvent): boolean {
  return event.button === 0;
}

export function isPointerClick(event: ReactMouseEvent | MouseEvent): boolean {
  return event.detail > 0;
}

/**
 * Swallows the rest of the current press, including its focus change and click.
 *
 * Normalizes touch and mouse handling, whose click targets are resolved at different
 * points in the press: touch on release, mouse on press.
 */
export function swallowNextPress(): void {
  standDown?.();

  function swallowFocus(event: MouseEvent) {
    event.preventDefault();
  }

  function swallowClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    standDown?.();
  }

  function abandon() {
    standDown?.();
  }

  const timer = setTimeout(abandon, MAX_CLICK_DELAY_MS);

  document.addEventListener("mousedown", swallowFocus, true);
  document.addEventListener("click", swallowClick, true);
  document.addEventListener("pointerdown", abandon, true);

  standDown = () => {
    standDown = null;

    clearTimeout(timer);
    document.removeEventListener("mousedown", swallowFocus, true);
    document.removeEventListener("click", swallowClick, true);
    document.removeEventListener("pointerdown", abandon, true);
  };
}
