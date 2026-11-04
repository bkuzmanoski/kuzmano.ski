import { useEffect } from "react";

import { scrollIntoViewSilently } from "../audio/scroll.ts";
import { isIOS, isTouchOnly } from "../device.ts";
import { isEditableTarget } from "../keys.ts";

import { isSoftwareKeyboardShown, isVisualViewportZoomedIn } from "./use-viewport-height-above-software-keyboard.ts";

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** Far enough above the viewport that iOS does not find any part of the field under the keyboard. */
const HIDDEN_FIELD_OFFSET_PX = -2000;

/**
 * Maximum time to wait for the software keyboard to resize the visual viewport before restoring the field when focus
 * does not open the keyboard, e.g. when a hardware keyboard is attached.
 */
const SOFTWARE_KEYBOARD_SHOW_TIMEOUT_MS = 600; // On iPhone, the keyboard resizes the viewport within ~160ms of a focus event.

/**
 * Inserts an inert stand-in element before the field to preserve its layout and displayed value while the real field is
 * above the viewport.
 */
function placeStandInElement(field: TextField): TextField {
  const standInElement = field.cloneNode(true) as TextField;

  for (const attribute of ["id", "name", "required", "autofocus"]) {
    standInElement.removeAttribute(attribute);
  }

  standInElement.setAttribute("inert", "");
  standInElement.value = field.value;
  field.before(standInElement);
  standInElement.scrollTop = field.scrollTop;
  standInElement.scrollLeft = field.scrollLeft;

  return standInElement;
}

/**
 * Prevents iOS from panning the visual viewport when a text field receives focus. Before
 * `useViewportHeightAboveSoftwareKeyboard` fits the desktop above the software keyboard, iOS calculates a pan offset to
 * reveal the field. Once the desktop fits, iOS reverses that pan, causing the desktop to jump down and slide back up.
 * This hook temporarily moves the field above the viewport so iOS does not need to pan it into view.
 */
export function usePreventViewportPanOnTextFieldFocus(): void {
  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport || !isIOS()) {
      return;
    }

    const hideFieldFromViewportPan = (event: FocusEvent) => {
      const field = event.target;

      if (
        !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) ||
        !isEditableTarget(field) ||
        !isTouchOnly() ||
        isVisualViewportZoomedIn(viewport) // `useViewportHeightAboveSoftwareKeyboard` does not fit the desktop above the keyboard while the page is zoomed in, so iOS still has to pan to reveal the field.
      ) {
        return;
      }

      const { width, height } = field.getBoundingClientRect();
      const fieldStyle = field.getAttribute("style");
      const standInElement = placeStandInElement(field);
      const controller = new AbortController();

      const returnField = () => {
        if (controller.signal.aborted) {
          return;
        }

        controller.abort();

        if (fieldStyle === null) {
          field.removeAttribute("style");
        } else {
          field.setAttribute("style", fieldStyle);
        }

        standInElement.remove();

        // Because the hook prevents iOS from panning, it does not scroll the field into view. Wait a frame for the
        // browser to lay out the window within the desktop fitted above the keyboard before scrolling.
        requestAnimationFrame(() => scrollIntoViewSilently(field));
      };

      // Takes the field out of the layout while preserving its measured size so its text does not reflow; the stand-in
      // preserves the field's layout space.
      Object.assign(field.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: `${width}px`,
        height: `${height}px`,
        transform: `translateY(${HIDDEN_FIELD_OFFSET_PX}px)`,
      });

      // Input before the software keyboard appears indicates a hardware keyboard, so iOS does not need to pan the field
      // into view.
      field.addEventListener("beforeinput", returnField, { signal: controller.signal });
      field.addEventListener("focusout", returnField, { signal: controller.signal });

      // When the software keyboard is already visible, iOS determines the pan distance as the field receives focus.
      if (isSoftwareKeyboardShown()) {
        requestAnimationFrame(() => requestAnimationFrame(returnField));
        return;
      }

      // The browser lays out the desktop fitted above the keyboard by `useViewportHeightAboveSoftwareKeyboard` in the
      // frame following the resize.
      viewport.addEventListener("resize", () => requestAnimationFrame(returnField), { signal: controller.signal });

      const timeout = setTimeout(returnField, SOFTWARE_KEYBOARD_SHOW_TIMEOUT_MS);

      controller.signal.addEventListener("abort", () => clearTimeout(timeout));
    };

    // Move the field on `focusin` as moving it on `touchend` cancels the tap and loses its caret position.
    document.addEventListener("focusin", hideFieldFromViewportPan, true);

    return () => document.removeEventListener("focusin", hideFieldFromViewportPan, true);
  }, []);
}
