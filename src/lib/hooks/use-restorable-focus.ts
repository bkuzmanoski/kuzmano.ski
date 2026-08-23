import { useEffect, useRef } from "react";

import { isTouchOnly } from "../device";
import { isEditableTarget } from "../keys";

import type { RefObject } from "react";

/**
 * Marks the chrome of a container: a region the user presses to act on the container itself
 * rather than to work within it (a title bar, a resize handle). A press there leaves the
 * focus where it is, and focus that lands there anyway is not remembered, so acting on the
 * container never costs the user their place inside it.
 */
export const PRESERVE_FOCUS_PROPS = { "data-preserve-focus": "" };

const PRESERVE_FOCUS_SELECTOR = "[data-preserve-focus]";

interface FocusRecord {
  contentKey: string;
  element: HTMLElement;
}

/**
 * Where focus belongs when a container is activated: the element that last held focus inside
 * it, or the container itself.
 *
 * A touch device is never returned to a field. Its software keyboard opens with the field that
 * takes the focus, and a tap to bring a container forward is not a request to type in it.
 */
function focusTarget(container: HTMLElement, record: FocusRecord | null, contentKey: string): HTMLElement {
  if (!record || (isTouchOnly() && isEditableTarget(record.element))) {
    return container;
  }

  const isRestorable = record.contentKey === contentKey && container.contains(record.element);

  return isRestorable ? record.element : container;
}

/**
 * Focus for a container that stays mounted while something else holds the focus.
 *
 * The container remembers the element that last held focus inside it and returns focus there
 * when it becomes active again, so a window switched away from and back to is left as the user
 * had it. It falls back to the container itself, which is where focus starts.
 *
 * A record stores the `contentKey` it was created under. When the container is reactivated
 * under a different key, the record is ignored.
 *
 * A press on the container's chrome keeps the focus where it is, rather than moving it to the
 * container. The press that activates an inactive container is not handled by this hook: it
 * belongs to the whole press, tail included, and `swallowNextPress` takes it as one.
 */
export function useRestorableFocus(
  ref: RefObject<HTMLElement | null>,
  { isActive, contentKey }: { isActive: boolean; contentKey: string },
): void {
  const lastFocusedRef = useRef<FocusRecord | null>(null);

  useEffect(() => {
    const container = ref.current;

    if (!container) {
      return;
    }

    function rememberFocus(event: FocusEvent) {
      const { target } = event;

      if (target instanceof HTMLElement && !target.closest(PRESERVE_FOCUS_SELECTOR)) {
        lastFocusedRef.current = { contentKey, element: target };
      }
    }

    function suppressFocusOnPress(event: MouseEvent) {
      const { target } = event;

      if (target instanceof HTMLElement && target.closest(PRESERVE_FOCUS_SELECTOR)) {
        event.preventDefault();
      }
    }

    container.addEventListener("focusin", rememberFocus);
    container.addEventListener("mousedown", suppressFocusOnPress);

    return () => {
      container.removeEventListener("focusin", rememberFocus);
      container.removeEventListener("mousedown", suppressFocusOnPress);
    };
  }, [ref, contentKey]);

  useEffect(() => {
    const container = ref.current;

    // Focus already inside the container is left alone: a press that landed on
    // a control has focused that control, and a restore must not overrule it.
    if (!isActive || !container || container.contains(document.activeElement)) {
      return;
    }

    focusTarget(container, lastFocusedRef.current, contentKey).focus({ preventScroll: true });

    // The remembered element may no longer be focusable, in which case the
    // call above was a no-op and the container itself receives focus.
    if (!container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }
  }, [ref, contentKey, isActive]);
}
