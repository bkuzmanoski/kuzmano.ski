import { usePressSound } from "../audio/use-press-sound.ts";
import { isPrimaryPress, releaseImplicitPointerCapture } from "../press.ts";

import { useMousePressStart } from "./use-mouse-press-start.ts";
import { useTrailingClick } from "./use-trailing-click.ts";

import type { MouseEvent, PointerEvent } from "react";

/**
 * Returns the handlers of a button that opens a menu when a press begins, so the pointer can stay down and travel to an
 * item. Calls `onPress` when a press with an input device begins, and `onActivate` for a `click` that does not end such
 * a press, which comes from the keyboard, a screen reader's activate action, or iOS retargeting a nearby tap.
 *
 * Calls `onPress` on `mousedown` for a mouse press, as only that event separates the press from the press Chrome
 * simulates for a screen reader's activate action (see `isSimulatedMouseDown`). The simulated press therefore reaches
 * `onActivate` through its `click`, like the activate action in Safari and Firefox. Calls `onPress` on `pointerdown`
 * for a touch or pen press, as the browser dispatches `mousedown` only after a tap ends.
 *
 * Prevents the default action of `mousedown`, as the browser would otherwise focus the button after the menu has
 * focused itself, which would stop arrow key navigation.
 *
 * Releases the pointer capture the browser implicitly sets on the button a touch lands on, so the pointer can reach
 * another button or an item while the finger stays down, like a mouse with its button held down.
 */
export function useMenuButtonPress({
  onPress,
  onActivate,
}: {
  onPress: (event: MouseEvent<HTMLButtonElement>) => void;
  onActivate: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const pressSoundHandlers = usePressSound();
  const trailingClick = useTrailingClick();
  const mousePressStart = useMousePressStart();

  function press(event: MouseEvent<HTMLButtonElement>) {
    trailingClick.recordPress();
    onPress(event);
  }

  return {
    ...pressSoundHandlers,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      pressSoundHandlers.onPointerDown(event);

      // Chromium dispatches pointer events to disabled buttons, including those disabled by a `<fieldset>`.
      if (!isPrimaryPress(event) || event.currentTarget.matches(":disabled")) {
        return;
      }

      if (!mousePressStart.recordPointerDown(event)) {
        releaseImplicitPointerCapture(event);
        press(event);
      }
    },
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
      pressSoundHandlers.onMouseDown(event);
      event.preventDefault();

      if (mousePressStart.consumeMouseDown(event)) {
        press(event);
      }
    },
    onPointerUp: trailingClick.onPointerUp,
    onClick: (event: MouseEvent<HTMLButtonElement>) => {
      pressSoundHandlers.onClick(event);

      if (!trailingClick.consume(event)) {
        onActivate(event);
      }
    },
  };
}
