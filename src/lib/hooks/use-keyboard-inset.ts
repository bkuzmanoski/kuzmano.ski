import { useEffect } from "react";

// Below this the difference between the two viewports is rounding, or a browser toolbar
// mid-collapse, rather than a keyboard. Treating it as zero keeps the desktop still.
const KEYBOARD_THRESHOLD_PX = 24;

function setKeyboardInset(inset: number) {
  const insetValue = inset > 0 ? `${inset}px` : "";

  if (document.documentElement.style.getPropertyValue("--keyboard-inset") !== insetValue) {
    document.documentElement.style.setProperty("--keyboard-inset", insetValue);
  }
}

/**
 * Publishes the height the software keyboard covers as `--keyboard-inset` on `<html>`,
 * for the desktop to subtract from its own height.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    const update = () => {
      // A pinch zoom shrinks the visual viewport the same way a keyboard does, and panning
      // a zoomed page is the visitor's own gesture, so the hook ignores both while zoomed in.
      if (viewport.scale > 1) {
        setKeyboardInset(0);
        return;
      }

      const viewportGap = window.innerHeight - viewport.height;
      const inset = viewportGap < KEYBOARD_THRESHOLD_PX ? 0 : Math.round(viewportGap);
      const isScrolled = window.scrollY !== 0; // Read before the write, so the browser does not recalculate the style of the whole document to return it.

      setKeyboardInset(inset);

      if (isScrolled) {
        window.scrollTo(0, 0);
      }
    };

    const controller = new AbortController();

    viewport.addEventListener("resize", update, { signal: controller.signal });
    viewport.addEventListener("scroll", update, { signal: controller.signal });
    update();

    return () => {
      controller.abort();
      document.documentElement.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
