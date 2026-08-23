/** The longest a click can take to arrive after the press it belongs to. */
export const MAX_CLICK_DELAY_MS = 1_000;

let standDown: (() => void) | null = null;

/**
 * Swallows the rest of the press, including its focus change and click.
 *
 * Normalizes the handling of a press across touch and mouse, whose click targets are resolved
 * at different points in the press.
 *
 * Touch resolves the click target on release, so changes beneath the pointer can affect it;
 * mouse resolves it on press.
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
