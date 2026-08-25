import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";

import { cx } from "#/lib/class-names";
import { useTimer } from "#/lib/hooks/use-timer";

import styles from "./tooltip.module.css";

import type { ReactNode } from "react";

const HOVER_DELAY_MS = 400;

export const TAP_DISMISS_MS = 1_500;

/**
 * The wrapper sits between the caller and the control, so a control that is positioned or
 * sized by its parent can pass `className` here instead of styling itself. The tooltip anchors
 * to the wrapper, keeping it aligned with the control.
 *
 * `suppressed` prevents the tooltip from being shown and dismisses one that is already visible.
 * It is useful for controls with nothing to describe, such as a navigation button with nowhere
 * to go, and for controls that capture the pointer, such as a drag handle. Pointer capture
 * sends subsequent pointer events to the control, so the wrapper cannot detect when the pointer
 * leaves. The control therefore reports that it is busy, which also prevents the tooltip from
 * reappearing when the press gives the control focus.
 *
 * `persistOnPress` is for controls whose label describes the state they toggle. The label itself
 * provides feedback for the press, so the tooltip remains visible and updates to the new value
 * rather than being dismissed by the click that changed it.
 */
export function Tooltip({
  label,
  suppressed = false,
  persistOnPress = false,
  className,
  children,
}: {
  label: string;
  suppressed?: boolean;
  persistOnPress?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [wasSuppressed, setWasSuppressed] = useState(suppressed);
  const [labelAtTap, setLabelAtTap] = useState<string | null>(null);
  const [tapFeedbackCount, setTapFeedbackCount] = useState(0);
  const timer = useTimer();
  const isTapDismissPending = useRef(false);

  useEffect(() => {
    if (tapFeedbackCount === 0) {
      return;
    }

    const dismissal = setTimeout(() => {
      isTapDismissPending.current = false;
      setLabelAtTap(null);
      setIsOpen(false);
    }, TAP_DISMISS_MS);

    return () => clearTimeout(dismissal);
  }, [tapFeedbackCount]);

  if (suppressed !== wasSuppressed) {
    setWasSuppressed(suppressed);
    setIsOpen(false);
  }

  if (labelAtTap !== null && labelAtTap !== label) {
    setLabelAtTap(null);
    setIsOpen(true);
    setTapFeedbackCount((count) => count + 1);
  }

  const isVisible = isOpen && !suppressed;

  function show(delay: number) {
    if (isTapDismissPending.current) {
      return;
    }

    timer.cancel();

    if (suppressed) {
      return;
    }

    timer.start(() => setIsOpen(true), delay);
  }

  function startTapFeedback() {
    timer.cancel();

    if (suppressed) {
      return;
    }

    isTapDismissPending.current = true;
    setLabelAtTap(label);
    setTapFeedbackCount((count) => count + 1);
  }

  function hide() {
    timer.cancel();
    isTapDismissPending.current = false;
    setLabelAtTap(null);
    setIsOpen(false);
  }

  return (
    <span
      className={cx(styles.wrapper, className)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) {
          show(0);
        }
      }}
      onBlurCapture={hide}
      onPointerDownCapture={persistOnPress ? undefined : hide}
      onPointerEnter={() => show(HOVER_DELAY_MS)}
      onPointerLeave={(event) => {
        if (!persistOnPress || event.pointerType !== "touch") {
          hide();
        }
      }}
      onPointerCancel={hide}
      onPointerUp={(event) => {
        if (persistOnPress && event.pointerType === "touch") {
          startTapFeedback();
        }
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
