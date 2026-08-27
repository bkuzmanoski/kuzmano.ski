import { cloneElement, isValidElement, useEffect, useEffectEvent, useId, useRef, useState } from "react";

import { cx } from "#/lib/class-names";
import { useTimer } from "#/lib/hooks/use-timer";
import {
  hideAfterDelay,
  isGroupInGracePeriod,
  resetGroupGracePeriod,
  runPendingHideAction,
  startGroupGracePeriod,
} from "#/lib/tooltip";

import styles from "./tooltip.module.css";

import type { ReactNode } from "react";

export const HOVER_DELAY_MS = 400;

export function Tooltip({
  label,
  persistOnPress = false,
  showsState = false,
  suppressed = false,
  onDidHide, // Run when a visible tooltip is hidden. Use it to clear transient state once the tooltip has finished displaying it.
  className,
  children,
}: {
  label: string;
  persistOnPress?: boolean;
  showsState?: boolean;
  suppressed?: boolean;
  onDidHide?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [wasShowingState, setWasShowingState] = useState(showsState);
  const [wasSuppressed, setWasSuppressed] = useState(suppressed);
  const [isPointerHovering, setIsPointerHovering] = useState(false);
  const timer = useTimer();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const lastPointerTypeRef = useRef<string | null>(null);
  const reportHidden = useEffectEvent(() => onDidHide?.());

  if (suppressed !== wasSuppressed) {
    setWasSuppressed(suppressed);
    setIsOpen(false);
  }

  if (showsState !== wasShowingState) {
    setWasShowingState(showsState);

    // The control takes the tooltip over from the pointer while it displays its state. When it
    // stops, the tooltip goes with it unless a pointer is still on the control to keep it visible.
    setIsOpen(showsState || isPointerHovering);
  }

  const isVisible = isOpen && !suppressed;

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    resetGroupGracePeriod(wrapperRef.current);

    return () => {
      startGroupGracePeriod();
      reportHidden();
    };
  }, [isVisible]);

  function show(delay: number) {
    timer.cancel();

    if (suppressed) {
      return;
    }

    timer.start(() => {
      runPendingHideAction();
      setIsOpen(true);
    }, delay);
  }

  function hide(immediately: boolean = false) {
    timer.cancel();

    if (isVisible && !immediately) {
      hideAfterDelay(() => setIsOpen(false));
      return;
    }

    setIsOpen(false);
  }

  return (
    <span
      ref={wrapperRef}
      className={cx(styles.wrapper, className)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) {
          show(0);
        }
      }}
      onBlurCapture={() => {
        hide(true);
      }}
      onPointerDownCapture={(event) => {
        lastPointerTypeRef.current = event.pointerType;

        if (!persistOnPress) {
          hide(true);
        }
      }}
      onPointerEnter={(event) => {
        // iOS raises a synthesized mouse event after a tap. No pointer has arrived to hover,
        // so acting on it would surface a tooltip after the tap that dismissed it.
        const isSynthesizedAfterTouch = event.pointerType !== "touch" && lastPointerTypeRef.current === "touch";

        lastPointerTypeRef.current = event.pointerType;

        if (isSynthesizedAfterTouch) {
          return;
        }

        const isHovering = event.pointerType !== "touch";

        setIsPointerHovering(isHovering);

        // The grace period is a hover affordance. A touch pointer has not travelled from a
        // neighbouring control, and showing on contact would pre-empt the press it is about to make.
        const skipsHoverDelay = isHovering && isGroupInGracePeriod(wrapperRef.current);

        show(skipsHoverDelay ? 0 : HOVER_DELAY_MS);
      }}
      onPointerLeave={(event) => {
        const wasHovering = isPointerHovering;

        setIsPointerHovering(false);
        timer.cancel();
        lastPointerTypeRef.current = event.pointerType;

        // Only a pointer that was hovering can leave one. A touch lifting, and the synthesized
        // mouse event iOS raises around a tap, are the tap finishing rather than a pointer moving
        // away, and must not hide a tooltip the press has just shown.
        if (!wasHovering) {
          return;
        }

        hide();
      }}
      onPointerCancel={(event) => {
        lastPointerTypeRef.current = event.pointerType;
        setIsPointerHovering(false);
        hide(true);
      }}
    >
      {isValidElement<{ "aria-describedby"?: string }>(children)
        ? cloneElement(children, { "aria-describedby": isVisible ? id : undefined })
        : children}
      {isVisible && (
        <span id={id} className={styles.tip} role="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}
