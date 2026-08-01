import clsx from "clsx";
import { cloneElement, isValidElement, useId, useRef, useState } from "react";

import styles from "./tooltip.module.css";

import type { ReactNode } from "react";

const DELAY_MS = 400;

/**
 * The wrapper sits between the caller and the control, so a control that is
 * placed or sized by its parent hands `className` here instead of styling
 * itself. The tooltip anchors to the wrapper, so both stay together.
 */
export function Tooltip({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(delay: number) {
    cancelPendingTimer();
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
      onFocusCapture={() => show(0)}
      onBlurCapture={hide}
      onPointerEnter={() => show(DELAY_MS)}
      onPointerLeave={hide}
    >
      {isValidElement<{ "aria-describedby"?: string }>(children)
        ? cloneElement(children, { "aria-describedby": isOpen ? id : undefined })
        : children}
      {isOpen && (
        <span id={id} className={styles.tip} role="tooltip">
          {label}
        </span>
      )}
    </span>
  );
}
