import { useId, useRef, useState } from "react";

import ActiveIcon from "#/assets/images/window-control-active.svg?react";
import CloseIcon from "#/assets/images/window-control-close.svg?react";
import ResizeIcon from "#/assets/images/window-control-resize.svg?react";
import ZoomIcon from "#/assets/images/window-control-zoom.svg?react";
import { playClick } from "#/lib/audio/sounds";
import { usePressSound } from "#/lib/audio/use-press-sound";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/use-is-boot-sequence-complete";
import { cx } from "#/lib/class-names";
import { containsPoint } from "#/lib/geometry";
import { useDoublePress } from "#/lib/hooks/use-double-press";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import { PRESERVE_FOCUS_PROPS, useRestorableFocus } from "#/lib/hooks/use-restorable-focus";
import { mergeHandlers } from "#/lib/merge-handlers";
import { isPrimaryPress, swallowNextPress } from "#/lib/press";

import { ScrollPane } from "./scroll-pane";
import { Tooltip } from "./tooltip";
import styles from "./window.module.css";

import type { PointerEvent, ReactNode } from "react";

/** A known id carried by the focused window's content container to give the skip link a stable target. */
export const FOCUSED_WINDOW_CONTENT_ID = "window-content";

/** Where a window is being dragged to, reported while the gesture runs so an outline can stand in for it. */
export type WindowDrag = { kind: "move"; x: number; y: number } | { kind: "resize"; width: number; height: number };

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

  // iOS sends the touch press to the title bar when it retargets the tap to this button.
  // The title bar already plays the press sound, so playing one here would play it twice.
  const pressSoundHandlers = usePressSound({ playOnClickWithoutPress: false });

  return (
    <Tooltip label={label} margin={6} className={cx(styles.control, className)}>
      <button
        type="button"
        className={styles.controlButton}
        aria-label={label}
        {...mergeHandlers(pressSoundHandlers, {
          onClick,
          onPointerDown: (event: PointerEvent) => {
            event.stopPropagation();

            if (isPrimaryPress(event)) {
              setIsPressed(true);
            }
          },
          onPointerLeave: () => setIsPressed(false),
          onPointerUp: () => setIsPressed(false),
        })}
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
  onDrag,
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
  unplaced: boolean; // The desktop has not been measured so CSS places the window (see `/src/components/window.module.css`).
  onClose: () => void;
  onZoom: (() => void) | null;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: ((width: number, height: number) => void) | null; // `null` on a fixed-size window, which also hides the resize control from its scrollbar.
  onDrag: (drag: WindowDrag | null) => void; // The current drag state, or `null` once it has ended.
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const fallbackContentId = useId();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const [isResizing, setIsResizing] = useState(false);
  const [isResizePressed, setIsResizePressed] = useState(false);
  const windowRef = useRef<HTMLElement>(null);
  const hasMovedWindowRef = useRef(false);
  const dragRef = useRef<WindowDrag | null>(null);

  useRestorableFocus(windowRef, { isActive: focused && !hidden, contentKey });

  function reportDrag(drag: WindowDrag) {
    dragRef.current = drag;
    onDrag(drag);
  }

  function endDrag() {
    const drag = dragRef.current;

    dragRef.current = null;
    onDrag(null);

    return drag;
  }

  const moveHandlers = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX, // The title bar also responds to a double click, which must survive the jitter of a press.
    canStart: (event) => !maximized && !(event.target as HTMLElement).closest("button"),
    start: () => {
      playClick();
      hasMovedWindowRef.current = false;

      return { x, y };
    },
    onDragMove: (delta, from) => reportDrag({ kind: "move", x: from.x + delta.dx, y: from.y + delta.dy }),
    onEnd: (moved) => {
      const drag = endDrag();

      hasMovedWindowRef.current = moved;

      if (drag?.kind === "move") {
        onMove(drag.x, drag.y);
      }
    },
  });

  const zoomHandlers = useDoublePress({
    onDoublePress: (event) => {
      if (!onZoom || (event.target as HTMLElement).closest("button")) {
        return;
      }

      if (maximized) {
        playClick();
        onZoom();
      } else if (!hasMovedWindowRef.current) {
        onZoom();
      }
    },
  });

  const resizeHandlers = usePointerDrag({
    start: (event) => {
      playClick();
      setIsResizing(true);
      setIsResizePressed(true);

      return {
        width,
        height,
        origin: { x: event.clientX, y: event.clientY },
        bounds: event.currentTarget.getBoundingClientRect(),
      };
    },
    onDragMove: (delta, from) => {
      reportDrag({ kind: "resize", width: from.width + delta.dx, height: from.height + delta.dy });

      if (!containsPoint(from.bounds, { x: from.origin.x + delta.dx, y: from.origin.y + delta.dy })) {
        setIsResizePressed(false);
      }
    },
    onEnd: () => {
      const drag = endDrag();

      setIsResizing(false);
      setIsResizePressed(false);

      if (drag?.kind === "resize") {
        onResize?.(drag.width, drag.height);
      }
    },
  });

  const contentId = focused ? FOCUSED_WINDOW_CONTENT_ID : fallbackContentId;
  const resizeControl =
    !onResize || maximized ? null : (
      <Tooltip label="Resize" suppressed={isResizing}>
        <button
          type="button"
          tabIndex={-1} // Drag handle is not keyboard accessible.
          className={cx(styles.controlResize, isResizePressed && styles.pressed)}
          aria-label="Resize"
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
      tabIndex={0} // A tab stop to focus the window before its contents and raise it to the top.
      style={maximized ? { zIndex: z } : { width, height, zIndex: z, ...(unplaced ? null : { left: x, top: y }) }} // A maximized window is laid out entirely by CSS. An unplaced window defines a size but is positioned by CSS.
      className={cx(
        styles.window,
        focused && styles.focused,
        maximized && styles.maximized,
        hidden && styles.hidden,
        unplaced && styles.unplaced,
        isBootSequenceComplete && styles.ready,
      )}
      aria-labelledby={titleId}
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
        <span className={styles.title} id={titleId}>
          {title}
        </span>
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
      <ScrollPane key={contentKey} id={contentId} resizeControl={resizeControl}>
        {children}
      </ScrollPane>
    </section>
  );
}
