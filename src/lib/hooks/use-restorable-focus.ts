import { useEffect, useRef } from "react";

import { isTouchOnly } from "../device.ts";
import { isEditableTarget } from "../keys.ts";

import type { RefObject } from "react";

export const PRESERVE_FOCUS_PROPS = { "data-preserve-focus": "" };

/** Marks the element to receive focus when its containing window opens. */
export const INITIAL_FOCUS_PROPS = { "data-initial-focus": "" };

const INITIAL_FOCUS_SELECTOR = "[data-initial-focus]";
const PRESERVE_FOCUS_SELECTOR = "[data-preserve-focus]";

interface FocusRecord {
  contentKey: string;
  element: HTMLElement;
}

const isAllowedFocusTarget = (element: HTMLElement) => !(isTouchOnly() && isEditableTarget(element)); // Focusing a text field on a touch-only device would open its software keyboard.

function focusTarget(container: HTMLElement, record: FocusRecord | null, contentKey: string): HTMLElement {
  if (record?.contentKey === contentKey && container.contains(record.element) && isAllowedFocusTarget(record.element)) {
    return record.element;
  }

  const initialFocusElement = container.querySelector<HTMLElement>(INITIAL_FOCUS_SELECTOR);

  return initialFocusElement && isAllowedFocusTarget(initialFocusElement) ? initialFocusElement : container;
}

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
