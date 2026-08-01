import clsx from "clsx";
import { useRef, useState } from "react";

import ActiveIcon from "#/assets/images/window-control-active.svg?react";
import CloseIcon from "#/assets/images/window-control-close.svg?react";
import ResizeIcon from "#/assets/images/window-control-resize.svg?react";
import ZoomIcon from "#/assets/images/window-control-zoom.svg?react";
import { playClick, playScroll } from "#/lib/sound";
import { usePointerDrag } from "#/lib/use-pointer-drag";

import { Scrollbar, useScrollMetrics } from "./scrollbar";
import styles from "./window.module.css";

import type { ReactNode } from "react";

export function Window({
  title,
  x,
  y,
  width,
  height,
  z,
  focused,
  maximized,
  onClose,
  onZoom,
  onFocus,
  onMove,
  onResize,
  children,
}: {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  focused: boolean;
  maximized: boolean;
  onClose: () => void;
  onZoom: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const { metrics, measure } = useScrollMetrics(viewport);

  const moveHandlers = usePointerDrag({
    canStart: (event) => !maximized && !(event.target as HTMLElement).closest("button"),
    start: () => ({ x, y }),
    onStart: (delta, from) => onMove(from.x + delta.dx, from.y + delta.dy),
  });

  const resizeHandlers = usePointerDrag({
    start: () => ({ width, height }),
    onStart: (delta, from) => onResize(from.width + delta.dx, from.height + delta.dy),
  });

  return (
    <section
      aria-label={title}
      className={clsx(styles.window, focused && styles.focused, maximized && styles.maximized)}
      style={maximized ? { zIndex: z } : { left: x, top: y, width, height, zIndex: z }}
      onPointerDownCapture={onFocus}
    >
      <header className={styles.titleBar} {...moveHandlers}>
        {focused && <div className={styles.bars} aria-hidden />}
        <span className={styles.title}>{title}</span>
        {focused && (
          <>
            <TitleBarButton className={styles.controlClose} icon={<CloseIcon />} label="Close" onClick={onClose} />
            <TitleBarButton className={styles.controlZoom} icon={<ZoomIcon />} label="Zoom" onClick={onZoom} />
          </>
        )}
      </header>
      <div className={styles.content}>
        <div
          ref={viewport}
          className={styles.viewport}
          onScroll={(event) => {
            measure();
            playScroll(event.currentTarget);
          }}
        >
          {children}
        </div>
        <Scrollbar
          metrics={metrics}
          onScrollTop={(top) => {
            if (viewport.current) {
              viewport.current.scrollTop = top;
            }
          }}
          onStep={(delta) => viewport.current?.scrollBy({ top: delta })}
          resizeControl={
            maximized ? null : (
              <button aria-label="Resize" className={styles.controlResize} type="button" {...resizeHandlers}>
                <ResizeIcon />
              </button>
            )
          }
        />
      </div>
    </section>
  );
}

function TitleBarButton({
  icon,
  label,
  className,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  className?: string;
  onClick: () => void;
}) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      aria-label={label}
      className={clsx(styles.control, className)}
      type="button"
      onClick={onClick}
      onPointerDown={(event) => {
        event.stopPropagation();
        setIsPressed(true);
        playClick();
      }}
      onPointerLeave={() => setIsPressed(false)}
      onPointerUp={() => setIsPressed(false)}
    >
      {isPressed ? <ActiveIcon /> : icon}
    </button>
  );
}
