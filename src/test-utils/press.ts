import { createEvent, fireEvent } from "@testing-library/react";

/** `PointerEvent` fields for a primary mouse press, without coordinates. */
export const MOUSE_PRESS_INIT = { pointerType: "mouse", pointerId: 1, button: 0, isPrimary: true };

/**
 * `PointerEvent` fields for a primary touch press, without coordinates. Shares `pointerId` with `MOUSE_PRESS_INIT` so
 * tests can follow either with the same move events.
 */
export const TOUCH_PRESS_INIT = { pointerType: "touch", pointerId: 1, button: 0, isPrimary: true };

/** `PointerEvent` fields for a secondary touch starting while a primary touch is active, without coordinates. */
export const SECOND_TOUCH_PRESS_INIT = { ...TOUCH_PRESS_INIT, pointerId: 2, isPrimary: false };

/** Dispatches a mouse press (`pointerdown` and `mousedown`) without releasing. */
export function pressWithMouse(element: Element) {
  fireEvent.pointerDown(element, MOUSE_PRESS_INIT);
  return fireEvent.mouseDown(element, { button: 0, detail: 1 });
}

// The events each browser dispatches for a screen reader's activate action, which differ from a press with a pointing
// device (see `isPointerClick` and `isSimulatedMouseDown` in `/src/lib/press/press.ts`). Each helper returns `false`
// when a listener prevents the default action of the `click`.

/**
 * Simulates a Chrome screen-reader activation (mouse pointer events with `detail: 0`, followed by a `click` with
 * `detail: 1`).
 */
export function activateWithScreenReaderInChrome(element: Element) {
  fireEvent.pointerDown(element, { pointerType: "mouse" });
  fireEvent.mouseDown(element, { detail: 0 });
  fireEvent.pointerUp(element, { pointerType: "mouse" });
  fireEvent.mouseUp(element, { detail: 0 });

  return fireEvent.click(element, { detail: 1 });
}

/** Mouse events and a `click` with a `detail` of `1` and an empty `pointerType`, without pointer events. */
export function activateWithScreenReaderInFirefox(element: Element) {
  fireEvent.mouseDown(element, { detail: 1 });
  fireEvent.mouseUp(element, { detail: 1 });

  return fireEvent(element, Object.assign(createEvent.click(element, { detail: 1 }), { pointerType: "" }));
}

/** A `click` with a `detail` of `0`, without pointer or mouse events. */
export function activateWithScreenReaderInSafari(element: Element) {
  return fireEvent.click(element, { detail: 0 });
}

/** Each browser's events for a screen reader's activate action, for `test.each`. */
export const SCREEN_READER_ACTIVATIONS = [
  ["Chrome", activateWithScreenReaderInChrome],
  ["Firefox", activateWithScreenReaderInFirefox],
  ["Safari", activateWithScreenReaderInSafari],
] as const;
