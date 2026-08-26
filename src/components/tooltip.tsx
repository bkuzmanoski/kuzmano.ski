import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";

import { cx } from "#/lib/class-names";
import { useTimer } from "#/lib/hooks/use-timer";
import { isPointerClick } from "#/lib/press";

import styles from "./tooltip.module.css";

import type { ReactNode } from "react";

export const HOVER_DELAY_MS = 400;
export const TAP_FEEDBACK_DURATION_MS = 1_500;

/**
 * The wrapper sits between the caller and the control, so a control that is positioned or
 * sized by its parent can pass `className` here instead of styling itself. The tooltip anchors
 * to the wrapper, keeping it aligned with the control.
 *
 * `suppressed` prevents the tooltip from being shown and hides one that is already visible.
 * It is useful for controls with nothing to describe, such as a navigation button with nowhere
 * to go, and for controls that capture the pointer, such as a drag handle. Pointer capture
 * sends subsequent pointer events to the control, so the wrapper cannot detect when the pointer
 * leaves. The control therefore reports that it is busy, which also prevents the tooltip from
 * reappearing when the press gives the control focus.
 *
 * `persistOnPress` is for controls whose label describes the state they toggle. The label itself
 * provides feedback for the press, so the tooltip remains visible and updates to the new value.
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
  const [tapFeedbackLabel, setTapFeedbackLabel] = useState<string | null>(null);
  const [tapFeedbackVersion, setTapFeedbackVersion] = useState(0);
  const timer = useTimer();
  const pressPointerTypeRef = useRef<string | null>(null);
  const isTapFeedbackActiveRef = useRef(false);

  useEffect(() => {
    if (tapFeedbackVersion === 0) {
      return;
    }

    const tapFeedbackTimeout = setTimeout(() => {
      isTapFeedbackActiveRef.current = false;
      setTapFeedbackLabel(null);
      setIsOpen(false);
    }, TAP_FEEDBACK_DURATION_MS);

    return () => clearTimeout(tapFeedbackTimeout);
  }, [tapFeedbackVersion]);

  if (suppressed !== wasSuppressed) {
    setWasSuppressed(suppressed);
    setIsOpen(false);
  }

  if (tapFeedbackLabel !== null && tapFeedbackLabel !== label) {
    setTapFeedbackLabel(null);
    setIsOpen(true);
    setTapFeedbackVersion((count) => count + 1);
  }

  const isVisible = isOpen && !suppressed;

  function show(delay: number) {
    if (isTapFeedbackActiveRef.current) {
      return;
    }

    timer.cancel();

    if (suppressed) {
      return;
    }

    timer.start(() => setIsOpen(true), delay);
  }

  function showTapFeedback() {
    timer.cancel();

    if (suppressed) {
      return;
    }

    isTapFeedbackActiveRef.current = true;
    setTapFeedbackLabel(label);
    setTapFeedbackVersion((count) => count + 1);
  }

  function hide() {
    timer.cancel();
    isTapFeedbackActiveRef.current = false;
    setTapFeedbackLabel(null);
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
      onPointerDownCapture={(event) => {
        pressPointerTypeRef.current = event.pointerType;

        if (!persistOnPress) {
          hide();
        }
      }}
      onPointerEnter={() => show(HOVER_DELAY_MS)}
      onPointerLeave={(event) => {
        if (!persistOnPress || event.pointerType !== "touch") {
          hide();
        }
      }}
      onPointerCancel={() => {
        pressPointerTypeRef.current = null;
        hide();
      }}
      onClick={(event) => {
        // iOS expands the hit target for small controls, but the resulting tap only delivers compatibility
        // mouse events and a click to the control. The touch pointer events go to the element under the
        // finger, so a click with no recorded press is treated as a tap. Keyboard activation has no detail.
        const isTap =
          pressPointerTypeRef.current === null ? isPointerClick(event) : pressPointerTypeRef.current === "touch";

        pressPointerTypeRef.current = null;

        if (persistOnPress && isTap) {
          showTapFeedback();
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
