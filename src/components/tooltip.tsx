import { cloneElement, isValidElement, useEffect, useEffectEvent, useId, useRef, useState } from "react";

import { cx } from "#/lib/class-names";
import { useTimer } from "#/lib/hooks/use-timer";

import styles from "./tooltip.module.css";

import type { ReactNode } from "react";

const HOVER_DELAY_MS = 400;

export const TAP_DISMISS_MS = 1_500;

/**
 * The wrapper sits between the caller and the control, so a control that is
 * placed or sized by its parent hands `className` here instead of styling
 * itself. The tooltip anchors to the wrapper, so both stay together.
 *
 * `disabled` suppresses the tooltip entirely for a control that is not interactive.
 *
 * `suppressed` is for controls that capture the pointer, such as a drag handle.
 * Capture retargets every pointer event to the control, so the wrapper never
 * sees the pointer leave and cannot dismiss the tooltip on its own. The control
 * reports that it is busy instead, which also keeps the tooltip from returning
 * on the focus the press just gave it.
 *
 * `persistOnPress` is for a control whose label reports the setting it toggles.
 * The label is the feedback for the press, so the tooltip stays up and re-reads
 * with the new value rather than leaving on the click that changed it.
 */
export function Tooltip({
  label,
  disabled = false,
  suppressed = false,
  persistOnPress = false,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  suppressed?: boolean;
  persistOnPress?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [wasSuppressed, setWasSuppressed] = useState(suppressed);
  const timer = useTimer();
  const labelAtTap = useRef<string | null>(null);
  const isTapDismissPending = useRef(false);

  if (suppressed !== wasSuppressed) {
    setWasSuppressed(suppressed);
    setIsOpen(false);
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

  function startTapDismissal() {
    timer.start(() => {
      isTapDismissPending.current = false;
      labelAtTap.current = null;
      setIsOpen(false);
    }, TAP_DISMISS_MS);
  }

  function startTapFeedback() {
    timer.cancel();

    if (suppressed) {
      return;
    }

    isTapDismissPending.current = true;
    labelAtTap.current = label;
    startTapDismissal();
  }

  const showTapFeedback = useEffectEvent(() => {
    labelAtTap.current = null;
    setIsOpen(true);
    startTapDismissal();
  });

  useEffect(() => {
    if (labelAtTap.current !== null && labelAtTap.current !== label) {
      showTapFeedback();
    }
  }, [label]);

  function hide() {
    isTapDismissPending.current = false;
    labelAtTap.current = null;
    timer.cancel();
    setIsOpen(false);
  }

  if (disabled) {
    return <span className={cx(styles.wrapper, className)}>{children}</span>;
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
