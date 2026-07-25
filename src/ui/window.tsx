import clsx from "clsx";
import { useRef } from "react";

import { useWindow } from "#/lib/window-manager";

import styles from "./window.module.css";

import type { ReactNode } from "react";

interface WindowProps {
  id: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
}

export function Window({ id, title, children, onClose }: WindowProps) {
  const { x, y, z, focused, focus, move } = useWindow(id);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  function onPointerDown(event: React.PointerEvent) {
    focus();
    dragRef.current = { dx: event.clientX - x, dy: event.clientY - y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (dragRef.current) {
      move(event.clientX - dragRef.current.dx, event.clientY - dragRef.current.dy);
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <section
      aria-label={title}
      className={clsx(styles.window, focused && styles.focused)}
      style={{ left: x, top: y, zIndex: z }}
      onPointerDownCapture={focus}
    >
      <header
        className={styles.titleBar}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {onClose ? (
          <button
            aria-label="Close"
            className={styles.close}
            type="button"
            onClick={onClose}
            onPointerDown={(event) => event.stopPropagation()}
          />
        ) : (
          <span className={styles.closeSpacer} />
        )}
        <span className={styles.title}>{title}</span>
      </header>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
