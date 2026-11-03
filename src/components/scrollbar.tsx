import { useEffect, useRef, useState } from "react";

import ArrowScrollbarIcon from "#/assets/images/scrollbar-icon-arrow.svg?react";
import { recordScrollAt, silenceScrollAt, stepScrollForPress } from "#/lib/audio/scroll.ts";
import { playClickSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/hooks/use-pointer-drag.ts";
import type { DragDelta } from "#/lib/hooks/use-pointer-drag.ts";
import type { ScrollMetrics } from "#/lib/hooks/use-scroll-metrics.ts";
import { useTimer } from "#/lib/hooks/use-timer.ts";
import { useTrailingClick } from "#/lib/hooks/use-trailing-click.ts";
import { clamp } from "#/lib/math.ts";
import { isPrimaryPress } from "#/lib/press.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./scrollbar.module.css";

import type { ReactNode, PointerEvent as ReactPointerEvent, RefObject } from "react";

/** The distance one press on a scrollbar arrow scrolls the viewport. */
export const ARROW_STEP_PX = 40;

export const ARROW_STEP_REPEAT_INTERVAL_MS = 70;

/** How long a held scrollbar arrow waits before it repeats its step, so an ordinary press does not step twice. */
export const ARROW_STEP_REPEAT_DELAY_MS = 400;

function ScrollArrow({
  direction,
  hidden,
  onStep,
}: {
  direction: "up" | "down";
  hidden: boolean;
  /** `isRepeat` is `true` for each step after the first while the user holds the arrow down. */
  onStep: (isRepeat: boolean) => void;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const repeatTimer = useTimer();
  const trailingClick = useTrailingClick();
  const holdControllerRef = useRef<AbortController | null>(null);

  // Keep the hold alive until the pointer is released, even if it leaves the arrow's bounds.
  function endHold() {
    holdControllerRef.current?.abort();
    holdControllerRef.current = null;
    setIsPressed(false);
    repeatTimer.cancel();
  }

  function beginHold() {
    const holdController = new AbortController();

    holdControllerRef.current?.abort();
    holdControllerRef.current = holdController;

    window.addEventListener("pointerup", endHold, { signal: holdController.signal });
    window.addEventListener("pointercancel", endHold, { signal: holdController.signal });
  }

  // The scrollbar can unmount while the pointer is held, so the window listener must also be removed.
  useEffect(() => () => holdControllerRef.current?.abort(), []);

  function startRepeating() {
    const repeat = () => {
      onStep(true);
      repeatTimer.start(repeat, ARROW_STEP_REPEAT_INTERVAL_MS);
    };

    repeatTimer.start(repeat, ARROW_STEP_REPEAT_DELAY_MS);
  }

  return (
    <button
      type="button"
      tabIndex={-1}
      className={cx(styles.arrow, direction === "up" ? styles.arrowUp : styles.arrowDown)}
      style={hidden ? { visibility: "hidden" } : undefined} // Hidden rather than removed, so the arrow keeps its space in the scrollbar.
      aria-label={direction === "up" ? "Scroll up" : "Scroll down"}
      // A click that ends a press does not step, as its `pointerdown` already stepped. That includes the press Chrome
      // simulates for a screen reader's activate action. The action in Safari and Firefox has no preceding
      // `pointerdown`, and iOS can retarget a tap's click to the arrow without retargeting its pointer events, so each
      // of those steps here.
      onClick={(event) => {
        if (!trailingClick.consume(event)) {
          onStep(false);
        }
      }}
      onPointerUp={trailingClick.onPointerUp}
      onPointerDown={(event) => {
        if (!isPrimaryPress(event)) {
          return;
        }

        trailingClick.recordPress();
        beginHold();
        setIsPressed(true);
        onStep(false);
        startRepeating();
      }}
    >
      <ArrowScrollbarIcon
        className={cx(styles.arrowScrollbarIcon, direction === "down" && styles.down, isPressed && styles.filled)}
      />
    </button>
  );
}

export function Scrollbar({
  viewportRef,
  viewportId,
  metrics,
  className,
  resizeControl,
}: {
  viewportRef: RefObject<HTMLElement | null>;
  viewportId: string;
  metrics: ScrollMetrics;
  className?: string;
  resizeControl?: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const viewportHoldRef = useRef<{ viewport: HTMLElement; controller: AbortController } | null>(null);

  function releaseViewport() {
    const viewportHold = viewportHoldRef.current;

    viewportHoldRef.current = null;
    viewportHold?.controller.abort();
    viewportHold?.viewport.style.removeProperty("overflow-y");
  }

  // On iOS, momentum scrolling can continue after touching the scrollbar and overwrite its `scrollTop` updates.
  // Temporarily hiding the viewport's overflow stops that momentum without preventing scrollbar interaction.
  function holdViewport(event: ReactPointerEvent) {
    const viewport = viewportRef.current;

    if (event.pointerType !== "touch" || !viewport) {
      return; // Keep overflow visible for mouse input as hiding it would conceal classic scrollbars and reflow the content.
    }

    releaseViewport();

    const controller = new AbortController();

    viewportHoldRef.current = { viewport, controller };
    viewport.style.overflowY = "hidden";

    window.addEventListener("pointerup", releaseViewport, { signal: controller.signal });
    window.addEventListener("pointercancel", releaseViewport, { signal: controller.signal });
  }

  // The scrollbar can unmount during a touch, and the viewport can outlive it.
  useEffect(() => () => releaseViewport(), []);

  const hasOverflow = metrics.scrollHeight > metrics.clientHeight + 1;
  const scrollRange = metrics.scrollHeight - metrics.clientHeight;
  const scrollProgress = scrollRange > 0 ? clamp(metrics.top / scrollRange, 0, 1) : 0;
  const isAtTop = metrics.top <= 0.5;
  const isAtBottom = metrics.top >= scrollRange - 0.5;
  const scrolledPercent = Math.round(scrollProgress * 100);
  const thumbStyle: StyleWithVars = {
    "--scrollbar-thumb-proportion": hasOverflow ? metrics.clientHeight / metrics.scrollHeight : 1,
    "--scrollbar-thumb-position": scrollProgress,
    borderTopWidth: isAtTop ? 0 : undefined,
    borderBottomWidth: isAtBottom ? 0 : undefined,
  };

  // The thumb runs the length of the track less its own height. A drag maps that travel onto the scroll range.
  const thumbTravel = () => (trackRef.current?.clientHeight ?? 0) - (thumbRef.current?.clientHeight ?? 0);

  function dragScroll(delta: DragDelta, from: { top: number; travel: number; jumped?: boolean }) {
    const viewport = viewportRef.current;

    if (!viewport || from.travel <= 0) {
      return;
    }

    if (from.jumped) {
      from.jumped = false;
      recordScrollAt(viewport); // Resume scroll sounds after a jump.
    }

    viewport.scrollTop = from.top + (delta.dy / from.travel) * scrollRange;
  }

  const thumbHandlers = usePointerDrag({
    preventDefault: true,
    start: () => {
      playClickSound();
      return { top: metrics.top, travel: thumbTravel() };
    },
    onDragMove: dragScroll,
  });

  // A press on the track jumps to the pressed point, placing the thumb's center under the pointer. The point pressed
  // becomes the scrolled position and continues from there as a drag.
  const trackHandlers = usePointerDrag({
    preventDefault: true,
    threshold: DRAG_THRESHOLD_PX,
    canStart: (event) => event.target === trackRef.current,
    start: (event) => {
      const track = trackRef.current;
      const thumb = thumbRef.current;
      const viewport = viewportRef.current;
      const travel = thumbTravel();

      playClickSound();

      if (!track || !thumb || !viewport || travel <= 0 || scrollRange <= 0) {
        return { top: metrics.top, travel };
      }

      const thumbTop = event.clientY - track.getBoundingClientRect().top - thumb.clientHeight / 2;
      const top = clamp(thumbTop / travel, 0, 1) * scrollRange;

      silenceScrollAt(viewport);
      viewport.scrollTop = top;

      return { top, travel, jumped: true };
    },
    onDragMove: dragScroll,
  });

  function step(delta: number, isRepeat: boolean) {
    if (viewportRef.current) {
      stepScrollForPress(viewportRef.current, delta, isRepeat);
    }
  }

  const isCollapsed = !hasOverflow && !resizeControl;

  return (
    <div
      className={cx(styles.scrollbar, className)}
      data-collapsed={isCollapsed || undefined}
      onPointerDownCapture={holdViewport}
    >
      <ScrollArrow direction="up" hidden={!hasOverflow} onStep={(isRepeat) => step(-ARROW_STEP_PX, isRepeat)} />
      <div
        ref={trackRef}
        className={cx(styles.track, hasOverflow && styles.filled)}
        role="scrollbar"
        aria-label="Vertical scrollbar"
        aria-orientation="vertical"
        aria-controls={viewportId}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={scrolledPercent}
        aria-valuetext={`${scrolledPercent}% scrolled`}
        {...trackHandlers}
      >
        {hasOverflow && <div ref={thumbRef} className={styles.thumb} style={thumbStyle} {...thumbHandlers} />}
      </div>
      <ScrollArrow direction="down" hidden={!hasOverflow} onStep={(isRepeat) => step(ARROW_STEP_PX, isRepeat)} />
      {resizeControl}
    </div>
  );
}
