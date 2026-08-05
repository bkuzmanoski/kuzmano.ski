import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";

import ActiveIcon from "#/assets/images/window-control-active.svg?react";
import CloseIcon from "#/assets/images/window-control-close.svg?react";
import ResizeIcon from "#/assets/images/window-control-resize.svg?react";
import ZoomIcon from "#/assets/images/window-control-zoom.svg?react";
import { playClick, playScroll, skipScroll } from "#/lib/audio/ui";
import { useIsBootSequenceComplete } from "#/lib/hooks/use-is-boot-sequence-complete";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag";

import { Scrollbar, useScrollMetrics } from "./scrollbar";
import { Tooltip } from "./tooltip";
import styles from "./window.module.css";

import type { ReactNode } from "react";

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

export function Window({
  title,
  x,
  y,
  width,
  height,
  z,
  tabIndex,
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
  tabIndex: number;
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
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const windowRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { metrics, measure } = useScrollMetrics(viewportRef);
  const [isResizing, setIsResizing] = useState(false);

  /* Focus the window element on window focus so that keyboard
   * navigation continues into its own controls. */
  useEffect(() => {
    const element = windowRef.current;

    /* Do not focus the window if it is:
     * - hidden: a window opened from an icon waits out the zoom rect behind `visibility: hidden` and cannot be focused
     * - already focused: a press that landed on a control has focused that control, and must not be overruled. */
    if (focused && !hidden && element && !element.contains(document.activeElement)) {
      element.focus({ preventScroll: true });
    }
  }, [focused, hidden]);

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
      ref={windowRef}
      aria-label={title}
      className={clsx(
        styles.window,
        focused && styles.focused,
        maximized && styles.maximized,
        hidden && styles.hidden,
        isBootSequenceComplete && styles.ready,
      )}
      style={maximized ? { zIndex: z } : { left: x, top: y, width, height, zIndex: z }}
      tabIndex={tabIndex}
      onFocus={onFocus}
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
          ref={viewportRef}
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
          tabIndex={tabIndex}
          onScrollTop={(top) => {
            if (viewportRef.current) {
              viewportRef.current.scrollTop = top;
            }
          }}
          onStep={(delta) => {
            const element = viewportRef.current;

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
                  tabIndex={-1} /* Drag handle is not keybaord accessible. */
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
