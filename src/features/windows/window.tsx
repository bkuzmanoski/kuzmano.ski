import { useId, useRef, useState } from "react";

import ActiveWindowControl from "#/assets/images/window-control-active.svg?react";
import CloseWindowControl from "#/assets/images/window-control-close.svg?react";
import ResizeWindowControl from "#/assets/images/window-control-resize.svg?react";
import ZoomWindowControl from "#/assets/images/window-control-zoom.svg?react";
import { ARROW_STEP_PX } from "#/components/scrollbar.tsx";
import { Tooltip } from "#/components/tooltip.tsx";
import { stepScrollForPress } from "#/lib/audio/scroll.ts";
import { playClick } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/lifecycle.ts";
import { cx } from "#/lib/class-names.ts";
import { containsPoint } from "#/lib/geometry.ts";
import { useDoublePress } from "#/lib/hooks/use-double-press.ts";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/hooks/use-pointer-drag.ts";
import { PRESERVE_FOCUS_PROPS, useRestorableFocus } from "#/lib/hooks/use-restorable-focus.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { isPrimaryPress, swallowNextPress } from "#/lib/press.ts";
import { WindowKeyDownContext, createWindowKeyDownHandlers } from "#/lib/window-manager/use-window-key-down.ts";

import { ScrollPane } from "./scroll-pane.tsx";
import styles from "./window.module.css";

import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

/** The id set on the focused window's content container, so the skip link has a stable target. */
export const FOCUSED_WINDOW_CONTENT_ID = "window-content";

/** Where a window is being dragged to, reported while the gesture runs so an outline can show the proposed position. */
export type WindowDrag = { kind: "move"; x: number; y: number } | { kind: "resize"; width: number; height: number };

function keyboardScrollDelta(event: KeyboardEvent, viewport: HTMLElement): number | null {
  const pageDistance = () => Math.max(viewport.clientHeight - ARROW_STEP_PX, ARROW_STEP_PX);

  switch (event.key) {
    case "ArrowUp":
      return -ARROW_STEP_PX;

    case "ArrowDown":
      return ARROW_STEP_PX;

    case "PageUp":
      return -pageDistance();

    case "PageDown":
      return pageDistance();

    case " ":
      return event.shiftKey ? -pageDistance() : pageDistance();

    case "Home":
      return -viewport.scrollHeight;

    case "End":
      return viewport.scrollHeight;

    default:
      return null;
  }
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
        {isPressed ? <ActiveWindowControl /> : icon}
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
  unplaced: boolean; // The desktop has not been measured so CSS places the window (see `/src/features/windows/window.module.css`).
  onClose: () => void;
  onZoom: (() => void) | null;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: ((width: number, height: number) => void) | null; // `null` on a fixed-size window, which also hides the resize control from its scrollbar.
  onDrag: (drag: WindowDrag | null) => void;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const inactiveDescriptionId = useId();
  const fallbackContentId = useId();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const [isResizing, setIsResizing] = useState(false);
  const [isResizePressed, setIsResizePressed] = useState(false);
  const [keyDownHandlers] = useState(createWindowKeyDownHandlers);
  const windowRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasMovedWindowRef = useRef(false);
  const dragRef = useRef<WindowDrag | null>(null);

  // The desktop is inert until the boot sequence completes, and focusing an element in inert content
  // has no effect, so the focused window takes the focus only once the boot sequence has completed.
  useRestorableFocus(windowRef, { isActive: focused && !hidden && isBootSequenceComplete, contentKey });

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
          tabIndex={-1}
          className={cx(styles.controlResize, isResizePressed && styles.pressed)}
          aria-label="Resize"
          {...PRESERVE_FOCUS_PROPS}
          {...resizeHandlers}
        >
          <ResizeWindowControl />
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
      aria-label={title} // Rather than `aria-labelledby` referencing the title, which Chromium ignores inside inert content.
      aria-describedby={focused ? undefined : inactiveDescriptionId}
      data-maximized={maximized || undefined}
      onFocus={onFocus}
      // The window is focused while none of its content is, but the browser scrolls only the scroll
      // container around the focused element, which the window is outside of. The keys that scroll a
      // page therefore scroll the window's content from here, unless a handler the content registered
      // claims the key first. A key with a modifier other than Shift is a shortcut, so it reaches
      // neither the content's handlers nor the scroll.
      onKeyDown={(event) => {
        const viewport = viewportRef.current;

        if (event.target !== event.currentTarget || !viewport || event.altKey || event.ctrlKey || event.metaKey) {
          return;
        }

        keyDownHandlers.handle(event);

        const delta = event.defaultPrevented ? null : keyboardScrollDelta(event, viewport);

        if (delta !== null) {
          event.preventDefault();
          stepScrollForPress(viewport, delta, event.repeat); // Each press plays the sound of a press on a scrollbar arrow.
        }
      }}
      onPointerDownCapture={() => {
        if (!focused) {
          swallowNextPress();
        }

        onFocus();
      }}
    >
      <span id={inactiveDescriptionId} hidden>
        Inactive window
      </span>
      {/* An inactive window's contents are inert, so the window itself is its only tab stop and
          neither the Tab key nor a screen reader reaches the content its scrim covers. */}
      <div className={styles.contents} inert={!focused}>
        <header className={styles.titleBar} {...PRESERVE_FOCUS_PROPS} {...mergeHandlers(moveHandlers, zoomHandlers)}>
          {focused && <div className={styles.bars} aria-hidden />}
          <span className={styles.title}>{title}</span>
          {focused && (
            <>
              <TitleBarButton
                className={styles.controlClose}
                icon={<CloseWindowControl />}
                label="Close"
                onClick={onClose}
              />
              {onZoom && (
                <TitleBarButton
                  className={styles.controlZoom}
                  icon={<ZoomWindowControl />}
                  label="Zoom"
                  onClick={onZoom}
                />
              )}
            </>
          )}
        </header>
        {toolbar}
        <ScrollPane key={contentKey} id={contentId} viewportRef={viewportRef} resizeControl={resizeControl}>
          <WindowKeyDownContext value={keyDownHandlers}>{children}</WindowKeyDownContext>
        </ScrollPane>
      </div>
    </section>
  );
}
