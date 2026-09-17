import type { KeyboardEvent } from "react";

const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;

export type ArrowKey = (typeof ARROW_KEYS)[number];

export const isArrowKey = (key: string): key is ArrowKey => ARROW_KEYS.includes(key as ArrowKey);

/** The keys that activate the control holding the focus. */
export const isActivationKey = (key: string) => key === "Enter" || key === " ";

/**
 * Activates a control that is not a `<button>`, such as a link, with Enter or Space.
 *
 * Returns whether the control was activated.
 */
export function activateOnKeyPress(event: KeyboardEvent, activate: () => void): boolean {
  const hasModifier = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

  if (!isActivationKey(event.key) || hasModifier) {
    return false;
  }

  event.preventDefault();

  if (!event.repeat) {
    activate();
  }

  return true;
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (EDITABLE_TAGS.has(target.tagName) || target.isContentEditable);
}
