import { playKeyDownSound, playKeyUpSound } from "./sounds.ts";

/**
 * Plays a key-down sound immediately, then plays a key-up sound and calls `onRelease` when the same
 * key is released.
 *
 * Key releases are captured on `window` so they are handled before page listeners and remain observable
 * if the caller stops listening after handling the press (on macOS, holding ⌘ can prevent key-up events
 * for other keys from reaching the window). The press ends without a key-up sound if the window blurs,
 * the key is pressed again without an observed release, or `signal` is aborted.
 */
export function playKeyPressSounds(
  keyDownEvent: KeyboardEvent,
  { onRelease, signal }: { onRelease?: (keyUpEvent: KeyboardEvent) => void; signal?: AbortSignal } = {},
) {
  const { code } = keyDownEvent;
  const controller = new AbortController();
  const captureOptions = { capture: true, signal: controller.signal };

  playKeyDownSound();

  window.addEventListener(
    "keyup",
    (event) => {
      if (event.code === code) {
        controller.abort();
        playKeyUpSound();
        onRelease?.(event);
      }
    },
    captureOptions,
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.code === code && !event.repeat) {
        controller.abort();
      }
    },
    captureOptions,
  );
  window.addEventListener("blur", () => controller.abort(), { signal: controller.signal });
  signal?.addEventListener("abort", () => controller.abort(), { signal: controller.signal });
}
