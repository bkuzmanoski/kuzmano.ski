import { isOneOf } from "./guards.ts";

import type { KeyboardEvent } from "react";

const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;

export type ArrowKey = (typeof ARROW_KEYS)[number];

export const isArrowKey = isOneOf(ARROW_KEYS);

const CARET_SCROLL_KEYS = new Set([...ARROW_KEYS, "Home", "End", "PageUp", "PageDown"]);
const FUNCTION_KEY = /^F\d{1,2}$/;

export const isCaretScrollKey = (key: string) => CARET_SCROLL_KEYS.has(key);
export const isBrowserShortcut = (event: { key: string; metaKey: boolean; ctrlKey: boolean }) =>
  event.metaKey || event.ctrlKey || FUNCTION_KEY.test(event.key);
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

const TEXT_ENTRY_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

/** Whether `target` accepts typed text (a text-entry `<input>`, a `<textarea>`, or a `contenteditable` element). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) {
    return TEXT_ENTRY_INPUT_TYPES.has(target.type); // `type` reads as `text` for a missing or unknown `type` attribute.
  }

  return target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
}
