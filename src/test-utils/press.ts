import { createEvent, fireEvent } from "@testing-library/react";

/** The `PointerEvent` fields of a primary press with a mouse, without a position. */
export const MOUSE_PRESS_INIT = { pointerType: "mouse", pointerId: 1, button: 0, isPrimary: true };

/** The `PointerEvent` fields of a primary press with a touch, without a position. */
export const TOUCH_PRESS_INIT = { pointerType: "touch", pointerId: 1, button: 0, isPrimary: true };

/** The events of a press with a mouse, up to the release. */
export function pressWithMouse(element: Element) {
  fireEvent.pointerDown(element, MOUSE_PRESS_INIT);
  return fireEvent.mouseDown(element, { button: 0, detail: 1 });
}

// The events each browser dispatches for a screen reader's activate action, which differ from a press with a pointing
// device (see `isPointerClick` and `isSimulatedMouseDown` in `/src/lib/press.ts`). Each helper returns `false` when a
// listener prevents the default action of the `click`.

/** A whole press with a `pointerType` of `mouse`, in which only the `click` has a `detail` of `1`. */
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
