import { useRef } from "react";

import { useEventListeners } from "../hooks/use-event-listeners.ts";
import { useTimer } from "../hooks/use-timer.ts";

/**
 * How long to watch for a scroll or zoom after an outside touch is canceled.
 *
 * Browsers do not dispatch `pointerup` after `pointercancel`, so this limit prevents an aborted gesture, such as a
 * canceled Android back swipe, from matching unrelated scrolls or resizes indefinitely.
 */
export const CANCELED_OUTSIDE_TOUCH_GRACE_PERIOD_MS = 300;

/**
 * Dismisses a sticky menu when a touch starting outside it ends, scrolls outside it, or zooms the page.
 *
 * Tracking begins on `window` in the capture phase so `onFocusIn` can defer dismissal during the touch. This also
 * accommodates Android's back gesture, which cancels the pointer before sending a `CloseWatcher` close request. After
 * cancellation, tracking continues for `CANCELED_OUTSIDE_TOUCH_GRACE_PERIOD_MS` to catch a scroll or zoom. If the grace
 * period expires with no tracked touches active and focus outside the menu, the menu is dismissed.
 */
export function useOutsideTouchDismissal({
  isInsideMenu,
  canDismiss,
  isSticky,
  onDismiss,
}: {
  isInsideMenu: (target: EventTarget | null) => boolean;
  canDismiss: () => boolean;
  isSticky: () => boolean;
  onDismiss: () => void;
}) {
  const canceledTouchGracePeriodTimer = useTimer();
  const activeTouchIdsRef = useRef<Set<number>>(new Set());
  const isWithinCanceledTouchGracePeriodRef = useRef(false);

  const hasActiveTouch = () => activeTouchIdsRef.current.size > 0;
  const isTrackingOutsideTouch = () => hasActiveTouch() || isWithinCanceledTouchGracePeriodRef.current;

  function endCanceledTouchGracePeriod() {
    isWithinCanceledTouchGracePeriodRef.current = false;
    canceledTouchGracePeriodTimer.cancel();
  }

  function dismiss() {
    activeTouchIdsRef.current.clear();
    endCanceledTouchGracePeriod();
    onDismiss();
  }

  useEventListeners(
    "window",
    {
      pointerdown: (event) => {
        if (event.pointerType === "touch" && isSticky() && !isInsideMenu(event.target) && canDismiss()) {
          activeTouchIdsRef.current.add(event.pointerId);
        } else if (event.pointerType !== "touch" || isInsideMenu(event.target)) {
          activeTouchIdsRef.current.clear();
          endCanceledTouchGracePeriod();
        }
      },
      scroll: (event) => {
        if (isTrackingOutsideTouch() && !isInsideMenu(event.target) && canDismiss()) {
          dismiss(); // Dismiss when a touch started outside the menu causes an outside scroll, like an outside mouse press.
        }
      },
    },
    { capture: true },
  );

  useEventListeners("visualViewport", {
    resize: () => {
      if (isTrackingOutsideTouch() && canDismiss()) {
        dismiss(); // Dismiss on pinch zoom started outside the menu, even without scrolling. Zoom changes trigger a visual viewport resize.
      }
    },
  });

  return {
    hasActiveTouch,
    /**
     * Consumes a tracked outside touch release, dismissing the menu if allowed. Returns `false` for untracked pointers
     * without affecting other touches.
     */
    consumePointerUp: (event: PointerEvent): boolean => {
      if (!activeTouchIdsRef.current.delete(event.pointerId)) {
        return false;
      }

      if (canDismiss()) {
        dismiss();
      }

      return true;
    },
    onPointerCancel: (event: PointerEvent): void => {
      if (!activeTouchIdsRef.current.delete(event.pointerId)) {
        return;
      }

      isWithinCanceledTouchGracePeriodRef.current = true;
      canceledTouchGracePeriodTimer.start(() => {
        isWithinCanceledTouchGracePeriodRef.current = false;

        if (!hasActiveTouch() && canDismiss() && !isInsideMenu(document.activeElement)) {
          onDismiss();
        }
      }, CANCELED_OUTSIDE_TOUCH_GRACE_PERIOD_MS);
    },
  };
}
