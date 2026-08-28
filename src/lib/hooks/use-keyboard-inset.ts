import { useEffect } from "react";

// Below this the difference between the two viewports is rounding, or a browser toolbar
// mid-collapse, rather than a keyboard. Treating it as zero keeps the desktop still.
const KEYBOARD_THRESHOLD = 24;

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
        document.documentElement.style.removeProperty("--keyboard-inset");
        return;
      }

      const gap = window.innerHeight - viewport.height;
      const inset = gap < KEYBOARD_THRESHOLD ? 0 : Math.round(gap);

      document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);

      if (window.scrollY !== 0) {
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
