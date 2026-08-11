import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";

import ActiveIcon from "#/assets/images/window-control-active.svg?react";
import CloseIcon from "#/assets/images/window-control-close.svg?react";
import ResizeIcon from "#/assets/images/window-control-resize.svg?react";
import ZoomIcon from "#/assets/images/window-control-zoom.svg?react";
import { playClick, playScroll, playScrollStep, skipScrollAt } from "#/lib/audio/ui";
import { useIsBootSequenceComplete } from "#/lib/hooks/use-is-boot-sequence-complete";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import { useScrollMetrics } from "#/lib/hooks/use-scroll-metrics";

import { Scrollbar } from "./scrollbar";
import { Tooltip } from "./tooltip";
import styles from "./window.module.css";

import type { ReactNode } from "react";

/** The id carried by the focused window's viewport, so the skip link has a stable target. */
export const WINDOW_CONTENT_ID = "window-content";

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

/** A scrolling viewport and the scrollbar that drives it. A window has one per pane. */
function ScrollPane({
  id,
  className,
  isResizing,
  resizeControl,
  children,
}: {
  id: string;
  className?: string;
  isResizing: boolean;
  resizeControl?: ReactNode;
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const { metrics, measure } = useScrollMetrics(viewportRef);

  const overscrolledEnd =
    metrics.top < -1 ? "start" : metrics.top + metrics.clientHeight > metrics.scrollHeight + 1 ? "end" : undefined; // A pixel of slack keeps a rounded height from reading as an overscroll at rest.

  return (
    <div className={clsx(styles.scrollPane, className)}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        data-overscrolled={overscrolledEnd}
        id={id}
        tabIndex={-1}
        onScroll={(event) => {
          measure();

          if (isResizing) {
            skipScrollAt(event.currentTarget);
            return;
          }

          playScroll(event.currentTarget);
        }}
      >
        {children}
      </div>
      <Scrollbar
        controls={id}
        metrics={metrics}
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

          const initialScrollTop = element.scrollTop;

          element.scrollBy({ top: delta });

          const didScroll = element.scrollTop !== initialScrollTop;

          if (didScroll) {
            playScrollStep(element);
          }

          return didScroll;
        }}
        resizeControl={resizeControl}
      />
    </div>
  );
}

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
  unplaced,
  sidebar,
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
  unplaced: boolean; // The desktop has not been measured so CSS places the window (see `window.module.css`).
  sidebar?: ReactNode;
  onClose: () => void;
  onZoom: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  children: ReactNode;
}) {
  const viewportId = useId();
  const sidebarId = useId();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const windowRef = useRef<HTMLElement>(null);
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

  const contentId = focused ? WINDOW_CONTENT_ID : viewportId;

  return (
    <section
      ref={windowRef}
      aria-label={title}
      className={clsx(
        styles.window,
        focused && styles.focused,
        maximized && styles.maximized,
        hidden && styles.hidden,
        unplaced && styles.unplaced,
        isBootSequenceComplete && styles.ready,
      )}
      /* A maximized window is laid out entirely by CSS. An unplaced one keeps its
       * size but leaves its position to CSS, which centres it on the desktop. */
      style={maximized ? { zIndex: z } : { width, height, zIndex: z, ...(unplaced ? null : { left: x, top: y }) }}
      tabIndex={0} // A tab stop to focus the window before its contents and raise it to the top.
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
        {sidebar && (
          <ScrollPane className={styles.sidebar} id={sidebarId} isResizing={isResizing}>
            {sidebar}
          </ScrollPane>
        )}
        <ScrollPane
          id={contentId}
          isResizing={isResizing}
          resizeControl={
            maximized ? null : (
              <Tooltip label="Resize" suppressed={isResizing}>
                <button
                  aria-label="Resize"
                  className={clsx(styles.controlResize, isResizing && styles.pressed)}
                  tabIndex={-1} /* Drag handle is not keyboard accessible. */
                  type="button"
                  {...resizeHandlers}
                >
                  <ResizeIcon />
                </button>
              </Tooltip>
            )
          }
        >
          {children}
        </ScrollPane>
      </div>
    </section>
  );
}
