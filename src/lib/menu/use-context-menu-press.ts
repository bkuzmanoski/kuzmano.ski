import { useRef } from "react";

import { playClickSound } from "../audio/sounds.ts";
import { clientPositionOf, distanceBetween } from "../geometry.ts";
import { useEventListeners } from "../hooks/use-event-listeners.ts";
import { useTimer } from "../hooks/use-timer.ts";
import { isPrimaryPress } from "../press/press.ts";
import { useMousePressStart } from "../press/use-mouse-press-start.ts";

import type { OpeningPress } from "./use-menu-interaction.ts";
import type { Position } from "../geometry.ts";

export const LONG_PRESS_DURATION_MS = 500;

/** How far a long press can move from where it began before its timer stops. */
export const LONG_PRESS_TOLERANCE_PX = 10;

export interface ContextMenuPress extends OpeningPress {
  /** The pointer's position when the menu opens, where the press began or a long press has drifted to. */
  origin: Position;
  /** The `pointerType` of the press, or `"mouse"` for a `contextmenu` event without a tracked press. */
  pointerType: string;
}

interface TrackedPress {
  pointerId: number;
  pointerType: string;
  origin: Position;
  position: Position;
  hasOpenedMenu: boolean;
}

/**
 * Opens a context menu for gestures on elements accepted by `isTarget` (i.e., native `contextmenu` events, Alt-primary
 * presses, and touch or pen long presses).
 */
export function useContextMenuPress({
  isTarget,
  onPress,
}: {
  isTarget: (target: EventTarget | null) => boolean;
  onPress: (press: ContextMenuPress) => void;
}) {
  const pressRef = useRef<TrackedPress | null>(null);
  const longPressTimer = useTimer();
  const mousePressStart = useMousePressStart();

  function open(origin: Position, isPointerHeld: boolean, pointerType: string) {
    longPressTimer.cancel();

    if (pressRef.current) {
      pressRef.current.hasOpenedMenu = true;
    }

    playClickSound();
    onPress({ origin, isPointerHeld, pointerType });
  }

  const onPointerDown = (event: PointerEvent) => {
    longPressTimer.cancel(); // A second touch begins a pinch rather than continuing a long press.

    if (!event.isPrimary) {
      return;
    }

    pressRef.current = null;

    if (!isTarget(event.target)) {
      return;
    }

    const position = clientPositionOf(event);
    const press = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      origin: position,
      position,
      hasOpenedMenu: false,
    };

    pressRef.current = press;

    if (mousePressStart.recordPointerDown(event) || !isPrimaryPress(event)) {
      return;
    }

    if (event.altKey) {
      open(position, true, event.pointerType);
    } else {
      // Trigger the menu using a timer as iOS does not dispatch `contextmenu` for long presses. On Android, where the
      // timer and native event may occur nearly simultaneously, only the first opens the menu.
      longPressTimer.start(() => open(press.position, true, press.pointerType), LONG_PRESS_DURATION_MS);
    }
  };

  const onMouseDown = (event: MouseEvent) => {
    if (mousePressStart.consumeMouseDown(event) && isPrimaryPress(event) && event.altKey && isTarget(event.target)) {
      event.preventDefault(); // The browser would otherwise move the focus to the body after the menu has focused itself.
      open(clientPositionOf(event), true, "mouse");
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const press = pressRef.current;

    if (press?.pointerId !== event.pointerId) {
      return;
    }

    press.position = clientPositionOf(event);

    if (distanceBetween(clientPositionOf(event), press.origin) > LONG_PRESS_TOLERANCE_PX) {
      longPressTimer.cancel();
    }
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (pressRef.current?.pointerId === event.pointerId) {
      pressRef.current = null;
      longPressTimer.cancel();
    }
  };

  const onContextMenu = (event: MouseEvent) => {
    if (!isTarget(event.target)) {
      return;
    }

    event.preventDefault();

    const press = pressRef.current;

    if (!press?.hasOpenedMenu) {
      // Windows dispatches `contextmenu` after the release, and macOS during the press.
      open(press?.position ?? clientPositionOf(event), press !== null, press?.pointerType ?? "mouse");
    }
  };

  // Listens on `document` instead of in the window's capture phase, so a menu mounted during `pointerdown` cannot
  // receive that same event through its own document listener as a new press.
  useEventListeners("document", {
    pointerdown: onPointerDown,
    mousedown: onMouseDown,
    pointermove: onPointerMove,
    pointerup: onPointerEnd,
    pointercancel: onPointerEnd,
    contextmenu: onContextMenu,
  });
}
