import { useId, useRef, useState } from "react";

import ActiveIcon from "#/assets/images/window-control-active.svg?react";
import CloseIcon from "#/assets/images/window-control-close.svg?react";
import ResizeIcon from "#/assets/images/window-control-resize.svg?react";
import ZoomIcon from "#/assets/images/window-control-zoom.svg?react";
import { playClick } from "#/lib/audio/sounds";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/use-is-boot-sequence-complete";
import { cx } from "#/lib/class-names";
import { useDoublePress } from "#/lib/hooks/use-double-press";
import { DRAG_THRESHOLD, usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import { PRESERVE_FOCUS_PROPS, useRestorableFocus } from "#/lib/hooks/use-restorable-focus";
import { mergeHandlers } from "#/lib/merge-handlers";
import { swallowNextPress } from "#/lib/press";

import { ScrollPane } from "./scroll-pane";
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
    <Tooltip label={label} className={cx(styles.control, className)}>
      <button
        type="button"
        aria-label={label}
        className={styles.controlButton}
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
  toolbar,
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
  onResize: ((width: number, height: number) => void) | null; // `null` on a fixed-size window, which drops the resize control from its scrollbar.
  toolbar?: ReactNode; // Sits between the title bar and the scroll pane, so it stays put while the content scrolls under it.
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
    onStart: (delta, from) => onResize?.(from.width + delta.dx, from.height + delta.dy),
    onEnd: () => setIsResizing(false),
  });

  useRestorableFocus(windowRef, { isActive: focused && !hidden, contentKey });

  const contentId = focused ? FOCUSED_WINDOW_CONTENT_ID : fallbackContentId;
  const resizeControl =
    !onResize || maximized ? null : (
      <Tooltip label="Resize" suppressed={isResizing}>
        <button
          type="button"
          aria-label="Resize"
          tabIndex={-1} // Drag handle is not keyboard accessible.
          className={cx(styles.controlResize, isResizing && styles.pressed)}
          {...PRESERVE_FOCUS_PROPS}
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
      className={cx(
        styles.window,
        focused && styles.focused,
        maximized && styles.maximized,
        hidden && styles.hidden,
        unplaced && styles.unplaced,
        isBootSequenceComplete && styles.ready,
      )}
      style={maximized ? { zIndex: z } : { width, height, zIndex: z, ...(unplaced ? null : { left: x, top: y }) }} // A maximized window is laid out entirely by CSS. An unplaced window defines a size but is positioned by CSS.
      tabIndex={0} // A tab stop to focus the window before its contents and raise it to the top.
      data-maximized={maximized || undefined}
      onFocus={onFocus}
      onPointerDownCapture={() => {
        if (!focused) {
          swallowNextPress();
        }

        onFocus();
      }}
    >
      <header className={styles.titleBar} {...PRESERVE_FOCUS_PROPS} {...mergeHandlers(moveHandlers, zoomHandlers)}>
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
      {toolbar}
      <ScrollPane key={contentKey} id={contentId} isResizing={isResizing} resizeControl={resizeControl}>
        {children}
      </ScrollPane>
    </section>
  );
}
