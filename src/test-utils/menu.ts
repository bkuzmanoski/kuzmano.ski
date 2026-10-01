import { fireEvent } from "@testing-library/react";

import { DEFAULT_ACTIVATION_FLASH_DURATION_MS } from "#/lib/hooks/use-activation-flash.ts";

import { advanceTimersBy } from "./timers.ts";

/**
 * Makes `document.elementFromPoint` return `element`, which `useMenuInteraction` hit-tests pointer events
 * against. Remove it after each test with `Reflect.deleteProperty(document, "elementFromPoint")`.
 */
export function stubElementFromPoint(element: Element) {
  Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => element });
}

/** Moves the pointer over `element`, which a menu reads from its document `pointermove` listener. */
export function movePointerOver(element: Element, init: MouseEventInit = {}) {
  stubElementFromPoint(element);
  fireEvent(document, new MouseEvent("pointermove", { bubbles: true, ...init }));
}

/** Releases the pointer over `element`, which a menu reads from its document `pointerup` listener. */
export function releasePointerOver(element: Element, init: MouseEventInit = {}) {
  stubElementFromPoint(element);
  fireEvent(document, new MouseEvent("pointerup", { bubbles: true, ...init }));
}

/** Advances the fake timers by an item's activation flash duration, so its action runs and its menu closes. */
export const runActivationFlash = () => advanceTimersBy(DEFAULT_ACTIVATION_FLASH_DURATION_MS);
