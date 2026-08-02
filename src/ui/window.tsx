import clsx from "clsx";
import { useId, useRef, useState } from "react";

import ActiveIcon from "#/assets/images/window-control-active.svg?react";
import CloseIcon from "#/assets/images/window-control-close.svg?react";
import ResizeIcon from "#/assets/images/window-control-resize.svg?react";
import ZoomIcon from "#/assets/images/window-control-zoom.svg?react";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import { playClick, playScroll, skipScroll } from "#/lib/sound";

import { Scrollbar, useScrollMetrics } from "./scrollbar";
import { Tooltip } from "./tooltip";
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
  hidden,
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
  hidden: boolean;
  onClose: () => void;
  onZoom: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  children: ReactNode;
}) {
  const viewportId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const { metrics, measure } = useScrollMetrics(viewport);
  const [isResizing, setIsResizing] = useState(false);

  const moveHandlers = usePointerDrag({
    canStart: (event) => !maximized && !(event.target as HTMLElement).closest("button"),
    start: () => ({ x, y }),
    onStart: (delta, from) => onMove(from.x + delta.dx, from.y + delta.dy),
  });

  const resizeHandlers = usePointerDrag({
    start: () => {
      playClick();
      setIsResizing(true);

      return { width, height };
    },
    onStart: (delta, from) => onResize(from.width + delta.dx, from.height + delta.dy),
    onEnd: () => setIsResizing(false),
  });

  const isScrolledToEnd =
    metrics.scrollHeight > metrics.clientHeight + 1 && metrics.top + metrics.clientHeight >= metrics.scrollHeight - 1;

  return (
    <section
      aria-label={title}
      className={clsx(styles.window, focused && styles.focused, maximized && styles.maximized, hidden && styles.hidden)}
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
          data-scrolled-to-end={isScrolledToEnd || undefined}
          id={viewportId}
          onScroll={(event) => {
            measure();

            if (isResizing) {
              skipScroll(event.currentTarget);
              return;
            }

            playScroll(event.currentTarget);
          }}
        >
          {children}
        </div>
        <Scrollbar
          controls={viewportId}
          metrics={metrics}
          onScrollTop={(top) => {
            if (viewport.current) {
              viewport.current.scrollTop = top;
            }
          }}
          onStep={(delta) => {
            const element = viewport.current;

            if (!element) {
              return false;
            }

            const before = element.scrollTop;

            element.scrollBy({ top: delta });

            return element.scrollTop !== before;
          }}
          resizeControl={
            maximized ? null : (
              <Tooltip label="Resize" suppressed={isResizing}>
                <button
                  aria-label="Resize"
                  className={clsx(styles.controlResize, isResizing && styles.pressed)}
                  type="button"
                  {...resizeHandlers}
                >
                  <ResizeIcon />
                </button>
              </Tooltip>
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
    <Tooltip label={label} className={clsx(styles.control, className)}>
      <button
        aria-label={label}
        className={styles.controlButton}
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
    </Tooltip>
  );
}
