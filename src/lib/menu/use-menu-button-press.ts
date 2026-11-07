import { releaseImplicitPointerCapture } from "../press/press.ts";
import { usePressSound } from "../press/use-press-sound.ts";
import { useTrailingClick } from "../press/use-trailing-click.ts";

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
  const trailingClick = useTrailingClick();

  // `usePressSound` detects press starts and ignores disabled buttons even though Chromium dispatches pointer events to
  // them, including buttons disabled through a `<fieldset>`.
  const pressSoundHandlers = usePressSound({
    onPressStart: (event) => {
      if (event.type === "pointerdown") {
        releaseImplicitPointerCapture(event as PointerEvent<HTMLButtonElement>);
      }

      trailingClick.recordPress();
      onPress(event as MouseEvent<HTMLButtonElement>); // The handlers are only attached to a `<button>`.
    },
  });

  return {
    ...pressSoundHandlers,
    onMouseDown: (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      pressSoundHandlers.onMouseDown(event);
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
