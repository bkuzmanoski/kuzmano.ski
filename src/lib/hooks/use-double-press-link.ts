import { useRef } from "react";

import { isBrowserHandledClick, isFollowingLink } from "../link.ts";
import { isPointerClick, isRepeatClick, isSimulatedMouseDown } from "../press.ts";

import { useDoublePress } from "./use-double-press.ts";

import type { MouseEvent as ReactMouseEvent } from "react";

/**
 * Opens a link with `onOpen` after a double press instead of navigating on a single press. Returns the `useDoublePress`
 * handlers along with `onMouseDown` and `onClick` handlers for the link.
 *
 * A modified or non-primary press does not call `onOpen`, and its `click` keeps its default behavior. `onMouseDown`
 * prevents the default action of its `mousedown`, so the link does not take the focus and handlers merged after this
 * one can detect the prevented press.
 *
 * `onClick` calls `onOpen` at once for a click without a corresponding press, such as a screen reader's activate action
 * in Safari and Firefox (see `isPointerClick`), and for the click of a simulated press (see `isSimulatedMouseDown`), as
 * a second press does not follow either.
 *
 * `isPressOpenable` describes the latest press. While it returns `false`, a double press does not call `onOpen`, and
 * `onClick` prevents the default action of a click that `isPointerClick` accepts. A click without a press ignores it,
 * as a click from Safari or Firefox does not belong to that press.
 *
 * `onClick` does not call `onOpen` for a click dispatched by `followLink`, or prevent that click's default action.
 */
export function useDoublePressLink({
  isPressOpenable = () => true,
  onOpen,
}: {
  isPressOpenable?: () => boolean;
  onOpen: () => void;
}) {
  const isSimulatedPressRef = useRef(false);
  const doublePressHandlers = useDoublePress({
    acceptsDoublePress: (event) => isPressOpenable() && !isBrowserHandledClick(event),
    onDoublePress: onOpen,
  });

  function onMouseDown(event: ReactMouseEvent) {
    isSimulatedPressRef.current = isSimulatedMouseDown(event);

    if (isBrowserHandledClick(event)) {
      event.preventDefault();
    }
  }

  function onClick(event: ReactMouseEvent<HTMLElement>) {
    if (isFollowingLink(event.currentTarget)) {
      return;
    }

    if (!isPressOpenable() && isPointerClick(event)) {
      event.preventDefault();
      return;
    }

    const isBrowserHandled = isBrowserHandledClick(event);

    if (isRepeatClick(event) || !isBrowserHandled) {
      event.preventDefault();
    }

    if (!isBrowserHandled && (!isPointerClick(event) || isSimulatedPressRef.current)) {
      onOpen();
    }
  }

  return { ...doublePressHandlers, onMouseDown, onClick };
}
