import { useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";

import ActiveWindowControl from "#/assets/images/window-control-active.svg?react";
import CloseWindowControl from "#/assets/images/window-control-close.svg?react";
import ResizeWindowControl from "#/assets/images/window-control-resize.svg?react";
import ZoomWindowControl from "#/assets/images/window-control-zoom.svg?react";
import { ARROW_STEP_PX } from "#/components/scrollbar.tsx";
import { Tooltip } from "#/components/tooltip.tsx";
import { stepScrollForPress } from "#/lib/audio/scroll.ts";
import { playClickSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { PRESERVE_FOCUS_PROPS, useRestorableFocus } from "#/lib/hooks/use-restorable-focus.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { isPrimaryPress, swallowNextPress } from "#/lib/press/press.ts";
import { usePressSound } from "#/lib/press/use-press-sound.ts";
import { useIsStartupSequenceComplete } from "#/lib/startup-sequence/lifecycle.ts";
import { keyboardScrollDelta } from "#/lib/window-manager/keyboard-scroll.ts";
import { WindowRevealContext } from "#/lib/window-manager/use-is-window-revealed.ts";
import { WindowKeyDownContext, createWindowKeyDownHandlers } from "#/lib/window-manager/use-window-key-down.ts";

import { ScrollPane } from "./scroll-pane.tsx";
import { useIsRevealedAfterStartup } from "./use-is-revealed-after-startup.ts";
import { useWindowDrag } from "./use-window-drag.ts";
import styles from "./window.module.css";

import type { PointerEvent, ReactNode } from "react";

/** The id set on the focused window's content container, so the skip link has a stable target. */
export const FOCUSED_WINDOW_CONTENT_ID = "window-content";

export type WindowSizingControls =
  | { kind: "resizable"; onZoom: () => void; onResize: (width: number, height: number) => void }
  | { kind: "fixed" }
  | {
      kind: "fitContentHeight";
      /** Reports the height the window renders at, as it ignores `height` and is as tall as its content. */
      onFitContentHeight: (height: number) => void;
    };

/** Where a window is being dragged to, reported while the gesture runs so an outline can show the proposed position. */
export type WindowDrag = { kind: "move"; x: number; y: number } | { kind: "resize"; width: number; height: number };

function TitleBarButton({
  icon,
  label,
  isTitleBarSilent,
  className,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  /** `true` when a press on the title bar does not play the press sound. */
  isTitleBarSilent: boolean;
  className?: string;
  onClick: () => void;
}) {
  const [isPressed, setIsPressed] = useState(false);

  // iOS sends the touch press to the title bar when it retargets the tap to this button. This button plays the press
  // sound of that tap only when the title bar does not, so the tap does not play it twice.
  const pressSoundHandlers = usePressSound({ playsOnClickWithoutPress: isTitleBarSilent });

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
  sizing,
  onClose,
  onFocus,
  onMove,
  onDrag,
  header,
  children,
}: {
  /** Used to invalidate scroll position when the content changes. */
  contentKey: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  focused: boolean;
  maximized: boolean;
  hidden: boolean;
  /**
   * `true` until the window manager measures the desktop, while CSS places the window (see
   * `/src/features/window-manager/window.module.css`).
   */
  unplaced: boolean;
  sizing: WindowSizingControls;
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onDrag: (drag: WindowDrag | null) => void;
  /** Rendered between the title bar and the scroll pane. */
  header?: ReactNode;
  children: ReactNode;
}) {
  const inactiveDescriptionId = useId();
  const fallbackContentId = useId();
  const isStartupSequenceComplete = useIsStartupSequenceComplete();
  const [keyDownHandlers] = useState(createWindowKeyDownHandlers);
  const windowRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const onZoom = sizing.kind === "resizable" ? sizing.onZoom : null;
  const onResize = sizing.kind === "resizable" ? sizing.onResize : null;
  const onFitContentHeight = sizing.kind === "fitContentHeight" ? sizing.onFitContentHeight : null;
  const fitsContentHeight = onFitContentHeight !== null;
  const reportContentHeight = useEffectEvent((nextHeight: number) => onFitContentHeight?.(nextHeight));

  // A layout effect so that the window manager places a window that has just opened by its content height before the
  // window first paints.
  useLayoutEffect(() => {
    const element = windowRef.current;

    if (!fitsContentHeight || !element) {
      return;
    }

    const measure = () => reportContentHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(element);

    return () => observer.disconnect();
  }, [fitsContentHeight]);

  const isRevealed = useIsRevealedAfterStartup(windowRef, isStartupSequenceComplete) && !hidden;

  // The desktop is inert until the startup sequence completes, and focusing an element in inert content has no effect,
  // so the focused window takes the focus only once the startup sequence has completed.
  useRestorableFocus(windowRef, { shouldHoldFocus: focused && !hidden && isStartupSequenceComplete, contentKey });

  const { titleBarHandlers, resizeHandlers, isResizing, isResizePressed } = useWindowDrag({
    x,
    y,
    width,
    height,
    maximized,
    onMove,
    onResize,
    onZoom,
    onDrag,
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
          aria-hidden="true" // The control resizes only by dragging, so a screen reader's activate action has no effect. Zoom resizes the window instead.
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
      style={
        maximized
          ? { zIndex: z }
          : {
              width,
              height: fitsContentHeight ? undefined : height,
              zIndex: z,
              ...(unplaced ? null : { left: x, top: y }),
            }
      } // A maximized window is laid out entirely by CSS. An unplaced window defines a size but is positioned by CSS.
      className={cx(
        styles.window,
        fitsContentHeight && styles.fitsContentHeight,
        focused && styles.focused,
        hidden && styles.hidden,
        unplaced && styles.unplaced,
        isStartupSequenceComplete && styles.ready,
        !isRevealed && styles.concealed,
      )}
      aria-label={title} // Rather than `aria-labelledby` referencing the title, which Chromium ignores inside inert content.
      aria-describedby={focused ? undefined : inactiveDescriptionId}
      // On iOS, VoiceOver skips regions themselves and stops only on their descendants. Inactive windows have no
      // accessible descendants outside their inert content, so exposing the window as a button gives it its own stop
      // and activates it when VoiceOver focuses it.
      role={focused ? undefined : "button"}
      data-maximized={maximized || undefined}
      onFocus={onFocus}
      onKeyDown={(event) => {
        // Scrolls the window's content for page-scrolling keys that reach the focused window instead of its content's
        // scroll container.

        const viewport = viewportRef.current;

        if (event.target !== event.currentTarget || !viewport) {
          return;
        }

        if (!event.altKey && !event.ctrlKey && !event.metaKey) {
          keyDownHandlers.handle(event);
        }

        const delta = event.defaultPrevented ? null : keyboardScrollDelta(event, viewport, ARROW_STEP_PX);

        if (delta !== null) {
          event.preventDefault();
          stepScrollForPress(viewport, delta, event.repeat); // Each press plays the sound of a press on a scrollbar arrow.
        }
      }}
      onPointerDownCapture={(event) => {
        if (!focused) {
          swallowNextPress();

          if (isPrimaryPress(event)) {
            playClickSound();
          }
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
        <div className={styles.titleBar} {...PRESERVE_FOCUS_PROPS} {...titleBarHandlers}>
          {focused && <div className={styles.bars} aria-hidden />}
          <span
            className={styles.title}
            aria-hidden="true" // The window's `aria-label` provides the title to a screen reader.
          >
            {title}
          </span>
          {focused && (
            <>
              <TitleBarButton
                className={styles.controlClose}
                icon={<CloseWindowControl />}
                label="Close"
                isTitleBarSilent={maximized}
                onClick={onClose}
              />
              {onZoom && (
                <TitleBarButton
                  className={styles.controlZoom}
                  icon={<ZoomWindowControl />}
                  label="Zoom"
                  isTitleBarSilent={maximized}
                  onClick={onZoom}
                />
              )}
            </>
          )}
        </div>
        {header}
        <ScrollPane
          key={contentKey}
          id={contentId}
          viewportRef={viewportRef}
          resizeControl={resizeControl}
          fitsContentHeight={fitsContentHeight}
        >
          <WindowRevealContext value={isRevealed}>
            <WindowKeyDownContext value={keyDownHandlers}>{children}</WindowKeyDownContext>
          </WindowRevealContext>
        </ScrollPane>
      </div>
    </section>
  );
}
