import { useEffect } from "react";

import { isEditableTarget } from "../keys.ts";

/**
 * Minimum difference between the layout and visual viewport heights that the hook treats as a software keyboard.
 * Rounding or a collapsing browser toolbar can produce a smaller difference, which the hook ignores.
 */
const MIN_SOFTWARE_KEYBOARD_HEIGHT_PX = 24;

/**
 * Delay before publishing an increase in the viewport height above the software keyboard. A decrease during this
 * interval cancels publishing the increase, so the desktop does not resize when iOS briefly removes and restores the
 * keyboard suggestion bar as the focus moves between fields.
 */
const VIEWPORT_HEIGHT_INCREASE_DELAY_MS = 150;

const readViewportHeightAboveSoftwareKeyboard = () =>
  document.documentElement.style.getPropertyValue("--viewport-height-above-software-keyboard");

function setViewportHeightAboveSoftwareKeyboard(height: number | null) {
  const heightValue = height === null ? "" : `${height}px`;

  if (readViewportHeightAboveSoftwareKeyboard() !== heightValue) {
    document.documentElement.style.setProperty("--viewport-height-above-software-keyboard", heightValue);
  }
}

export const isSoftwareKeyboardShown = (): boolean => readViewportHeightAboveSoftwareKeyboard() !== "";
export const isVisualViewportZoomedIn = (viewport: VisualViewport): boolean => viewport.scale > 1;

/**
 * Publishes the height of the visual viewport as the `--viewport-height-above-software-keyboard` custom property of
 * `<html>` while the software keyboard is shown.
 */
export function useViewportHeightAboveSoftwareKeyboard(): void {
  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    const viewportHeightAboveSoftwareKeyboard = (): number | null => {
      if (isVisualViewportZoomedIn(viewport)) {
        return null;
      }

      const viewportGap = isEditableTarget(document.activeElement) ? window.innerHeight - viewport.height : 0;

      return viewportGap < MIN_SOFTWARE_KEYBOARD_HEIGHT_PX ? null : Math.round(viewport.height);
    };

    let increaseTimeout: ReturnType<typeof setTimeout> | undefined;

    const publish = (height: number | null) => {
      clearTimeout(increaseTimeout);
      increaseTimeout = undefined;
      setViewportHeightAboveSoftwareKeyboard(height);
    };

    const update = () => {
      const height = viewportHeightAboveSoftwareKeyboard();
      const isScrolled = window.scrollY !== 0; // Reads `scrollY` before the custom property changes so the browser does not recalculate the style of the whole document to return it.
      const isTextEntryActive = isEditableTarget(document.activeElement) || isSoftwareKeyboardShown(); // Read before `publish` clears the property so the window still scrolls to the top when the viewport resizes after the keyboard hides on blur.
      const isIncrease =
        height !== null &&
        isSoftwareKeyboardShown() &&
        height > Number.parseFloat(readViewportHeightAboveSoftwareKeyboard());

      if (!isIncrease) {
        publish(height);
      } else if (increaseTimeout === undefined) {
        increaseTimeout = setTimeout(
          () => publish(viewportHeightAboveSoftwareKeyboard()),
          VIEWPORT_HEIGHT_INCREASE_DELAY_MS,
        );
      }

      // iOS may scroll the window to keep the focused field above the software keyboard. Do not reset the scroll
      // position while zoomed in, as the user may be panning the page manually.
      if (isScrolled && isTextEntryActive && !isVisualViewportZoomedIn(viewport)) {
        window.scrollTo(0, 0);
      }
    };

    const controller = new AbortController();

    viewport.addEventListener("resize", update, { signal: controller.signal });
    viewport.addEventListener("scroll", update, { signal: controller.signal });
    update();

    return () => {
      controller.abort();
      clearTimeout(increaseTimeout);
      document.documentElement.style.removeProperty("--viewport-height-above-software-keyboard");
    };
  }, []);
}
