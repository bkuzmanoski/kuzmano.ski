import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";

import ActiveIcon from "#/assets/images/window-control-active.svg?react";
import CloseIcon from "#/assets/images/window-control-close.svg?react";
import ResizeIcon from "#/assets/images/window-control-resize.svg?react";
import ZoomIcon from "#/assets/images/window-control-zoom.svg?react";
import { playClick, playScroll, playScrollStep, skipScrollAt } from "#/lib/audio/ui";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/use-is-boot-sequence-complete";
import { useDoublePress } from "#/lib/hooks/use-double-press";
import { DRAG_THRESHOLD, usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import { useScrollMetrics } from "#/lib/hooks/use-scroll-metrics";
import { mergeHandlers } from "#/lib/merge-handlers";

import { Scrollbar } from "./scrollbar";
import { Tooltip } from "./tooltip";
import styles from "./window.module.css";

import type { ReactNode } from "react";

/** A known id carried by the focused window's content container to give the skip link a stable target. */
export const FOCUSED_WINDOW_CONTENT_ID = "window-content";

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

function ScrollPane({
  id,
  isResizing,
  resizeControl,
  children,
}: {
  id: string;
  isResizing: boolean;
  resizeControl?: ReactNode;
  children: ReactNode;
}) {
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const { metrics, measure } = useScrollMetrics(contentContainerRef);

  const overscrolledEnd =
    metrics.top < -1 ? "start" : metrics.top + metrics.clientHeight > metrics.scrollHeight + 1 ? "end" : undefined; // A pixel of slack keeps a rounded height from reading as an overscroll at rest.

  return (
    <div className={styles.scrollPane}>
      <div
        ref={contentContainerRef}
        className={styles.contentContainer}
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
        viewportId={id}
        metrics={metrics}
        resizeControl={resizeControl}
        className={styles.scrollbar}
        onScrollTop={(top) => {
          if (contentContainerRef.current) {
            contentContainerRef.current.scrollTop = top;
          }
        }}
        onStep={(delta) => {
          const element = contentContainerRef.current;

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
      />
    </div>
  );
}

export function Window({
  contentKey,
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
  onClose,
  onZoom,
  onFocus,
  onMove,
  onResize,
  children,
}: {
  contentKey: string; // Used to invalidate scroll position when the content changes.
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
  onClose: () => void;
  onZoom: (() => void) | null;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  children: ReactNode;
}) {
  const fallbackContentId = useId();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const [isResizing, setIsResizing] = useState(false);
  const windowRef = useRef<HTMLElement>(null);
  const hasMovedWindowRef = useRef(false);

  const moveHandlers = usePointerDrag({
    threshold: DRAG_THRESHOLD, // The title bar also answers a double click, which must survive the jitter of a press.
    canStart: (event) => !maximized && !(event.target as HTMLElement).closest("button"),
    start: () => {
      hasMovedWindowRef.current = false;
      return { x, y };
    },
    onStart: (delta, from) => onMove(from.x + delta.dx, from.y + delta.dy),
    onEnd: (moved) => {
      hasMovedWindowRef.current = moved;
    },
  });

  const zoomHandlers = useDoublePress({
    onDoublePress: (event) => {
      if (!onZoom || (event.target as HTMLElement).closest("button")) {
        return;
      }

      if (maximized || !hasMovedWindowRef.current) {
        playClick();
        onZoom();
      }
    },
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

  useEffect(() => {
    const element = windowRef.current;

    // Do not focus the window if it is:
    // - hidden: a window opened from an icon waits out the zoom rect behind `visibility: hidden` and cannot be focused
    // - already focused: a press that landed on a control has focused that control, and must not be overruled.
    if (focused && !hidden && element && !element.contains(document.activeElement)) {
      element.focus({ preventScroll: true });
    }
  }, [focused, hidden, contentKey]);

  const contentId = focused ? FOCUSED_WINDOW_CONTENT_ID : fallbackContentId;
  const resizeControl = maximized ? null : (
    <Tooltip label="Resize" suppressed={isResizing}>
      <button
        aria-label="Resize"
        className={clsx(styles.controlResize, isResizing && styles.pressed)}
        tabIndex={-1} // Drag handle is not keyboard accessible.
        type="button"
        {...resizeHandlers}
      >
        <ResizeIcon />
      </button>
    </Tooltip>
  );

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
      style={maximized ? { zIndex: z } : { width, height, zIndex: z, ...(unplaced ? null : { left: x, top: y }) }} // A maximized window is laid out entirely by CSS. An unplaced window defines a size but is positioned by CSS.
      tabIndex={0} // A tab stop to focus the window before its contents and raise it to the top.
      onFocus={onFocus}
      onPointerDownCapture={onFocus}
    >
      <header className={styles.titleBar} {...mergeHandlers(moveHandlers, zoomHandlers)}>
        {focused && <div className={styles.bars} aria-hidden />}
        <span className={styles.title}>{title}</span>
        {focused && (
          <>
            <TitleBarButton className={styles.controlClose} icon={<CloseIcon />} label="Close" onClick={onClose} />
            {onZoom && (
              <TitleBarButton className={styles.controlZoom} icon={<ZoomIcon />} label="Zoom" onClick={onZoom} />
            )}
          </>
        )}
      </header>
      <ScrollPane key={contentKey} id={contentId} isResizing={isResizing} resizeControl={resizeControl}>
        {children}
      </ScrollPane>
    </section>
  );
}
