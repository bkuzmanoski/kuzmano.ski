import clsx from "clsx";
import { cloneElement, isValidElement, useId, useRef, useState } from "react";

import styles from "./tooltip.module.css";

import type { ReactNode } from "react";

const DELAY_MS = 400;

/**
 * The wrapper sits between the caller and the control, so a control that is
 * placed or sized by its parent hands `className` here instead of styling
 * itself. The tooltip anchors to the wrapper, so both stay together.
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (suppressed !== wasSuppressed) {
    setWasSuppressed(suppressed);
    setIsOpen(false);
  }

  const isVisible = isOpen && !suppressed;

  function show(delay: number) {
    cancelPendingTimer();

    if (suppressed) {
      return;
    }

    timerRef.current = setTimeout(() => setIsOpen(true), delay);
  }

  function hide() {
    cancelPendingTimer();
    setIsOpen(false);
  }

  function cancelPendingTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <span
      className={clsx(styles.wrapper, className)}
      onFocusCapture={(event) => {
        if (event.target.matches(":focus-visible")) {
          show(0);
        }
      }}
      onBlurCapture={hide}
      onPointerDownCapture={persistOnPress ? undefined : hide}
      onPointerEnter={() => show(DELAY_MS)}
      onPointerLeave={hide}
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
