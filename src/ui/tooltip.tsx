import { cloneElement, isValidElement, useId, useRef, useState } from "react";

import styles from "./tooltip.module.css";

import type { ReactNode } from "react";

const DELAY_MS = 400;

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
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
      className={styles.wrapper}
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
