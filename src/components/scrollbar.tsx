import { useEffect, useRef, useState } from "react";

import ArrowIcon from "#/assets/images/scroll-arrow.svg?react";
import { recordScrollAt, silenceScrollAt, stepScroll } from "#/lib/audio/scroll.ts";
import { playClick } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { DRAG_THRESHOLD_PX, usePointerDrag } from "#/lib/hooks/use-pointer-drag.ts";
import type { DragDelta } from "#/lib/hooks/use-pointer-drag.ts";
import type { ScrollMetrics } from "#/lib/hooks/use-scroll-metrics.ts";
import { useTimer } from "#/lib/hooks/use-timer.ts";
import { clamp } from "#/lib/math.ts";
import { isPointerClick, isPrimaryPress } from "#/lib/press.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./scrollbar.module.css";

import type { ReactNode, RefObject } from "react";

export const ARROW_STEP_PX = 40;
export const ARROW_STEP_REPEAT_INTERVAL_MS = 70;
export const ARROW_STEP_REPEAT_DELAY_MS = 400; // Delay repeating so an ordinary press does not step twice.

function ScrollArrow({
  direction,
  hidden,
  onStep,
}: {
  direction: "up" | "down";
  hidden: boolean;
  onStep: () => boolean;
}) {
  const [isPressed, setIsPressed] = useState(false);
  const repeatTimer = useTimer();
  const arrowRef = useRef<HTMLButtonElement>(null);
  const hasUnconsumedPressRef = useRef(false);
  const holdControllerRef = useRef<AbortController | null>(null);

  // Keep the hold alive until the pointer is released, even if it leaves the arrow's bounds.
  function endHold(event: PointerEvent) {
    holdControllerRef.current?.abort();
    holdControllerRef.current = null;

    const wasReleasedOnArrow = event.target instanceof Node && arrowRef.current?.contains(event.target);

    if (event.type === "pointercancel" || !wasReleasedOnArrow) {
      hasUnconsumedPressRef.current = false;
    }

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

  // A successful step plays its own sound. At the scroll boundary, where no step occur a click is played to indicate the press was received.
  function step(isRepeat = false) {
    if (!onStep() && !isRepeat) {
      playClick();
    }
  }

  function startRepeating() {
    const repeat = () => {
      step(true);
      repeatTimer.start(repeat, ARROW_STEP_REPEAT_INTERVAL_MS);
    };

    repeatTimer.start(repeat, ARROW_STEP_REPEAT_DELAY_MS);
  }

  return (
    <button
      ref={arrowRef}
      type="button"
      tabIndex={hidden ? -1 : undefined}
      className={cx(styles.arrow, direction === "up" ? styles.arrowUp : styles.arrowDown, hidden && styles.hidden)}
      aria-label={direction === "up" ? "Scroll up" : "Scroll down"}
      // Keyboard activation has no preceding `pointerdown`, so the click steps here. A pointer
      // click normally follows a `pointerdown` that already stepped and only clears that press.
      // iOS can retarget a tap's click to the arrow without retargeting its pointer events, in
      // which case the click has no corresponding press and must step here as well.
      onClick={(event) => {
        if (!isPointerClick(event) || !hasUnconsumedPressRef.current) {
          step();
        }

        hasUnconsumedPressRef.current = false;
      }}
      onPointerDown={(event) => {
        if (!isPrimaryPress(event)) {
          return;
        }

        hasUnconsumedPressRef.current = true;
        beginHold();
        setIsPressed(true);
        step();
        startRepeating();
      }}
    >
      <ArrowIcon className={cx(styles.arrowIcon, direction === "down" && styles.down, isPressed && styles.filled)} />
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

  const overflow = metrics.scrollHeight > metrics.clientHeight + 1;
  const range = metrics.scrollHeight - metrics.clientHeight;
  const position = range > 0 ? clamp(metrics.top / range, 0, 1) : 0;
  const isAtTop = metrics.top <= 0.5;
  const isAtBottom = metrics.top >= range - 0.5;
  const scrolledPercent = Math.round(position * 100);
  const thumbStyle: StyleWithVars = {
    "--thumb-proportion": overflow ? metrics.clientHeight / metrics.scrollHeight : 1,
    "--thumb-position": position,
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

    viewport.scrollTop = from.top + (delta.dy / from.travel) * range;
  }

  const thumbHandlers = usePointerDrag({
    preventDefault: true,
    start: () => {
      playClick();
      return { top: metrics.top, travel: thumbTravel() };
    },
    onDragMove: dragScroll,
  });

  // A press on the track jumps to the pressed point, placing the thumb's centre under the pointer.
  // The point pressed becomes the scrolled position and continues from there as a drag.
  const trackHandlers = usePointerDrag({
    preventDefault: true,
    threshold: DRAG_THRESHOLD_PX,
    canStart: (event) => event.target === trackRef.current,
    start: (event) => {
      const track = trackRef.current;
      const thumb = thumbRef.current;
      const viewport = viewportRef.current;
      const travel = thumbTravel();

      playClick();

      if (!track || !thumb || !viewport || travel <= 0 || range <= 0) {
        return { top: metrics.top, travel };
      }

      const thumbTop = event.clientY - track.getBoundingClientRect().top - thumb.clientHeight / 2;
      const top = clamp(thumbTop / travel, 0, 1) * range;

      silenceScrollAt(viewport); // Suppress scroll sounds for a jump.
      viewport.scrollTop = top;

      return { top, travel, jumped: true };
    },
    onDragMove: dragScroll,
  });

  const step = (delta: number) => (viewportRef.current ? stepScroll(viewportRef.current, delta) : false);

  const isCollapsed = !overflow && !resizeControl;

  return (
    <div className={cx(styles.scrollbar, className)} data-collapsed={isCollapsed || undefined}>
      <ScrollArrow direction="up" hidden={!overflow} onStep={() => step(-ARROW_STEP_PX)} />
      <div
        ref={trackRef}
        className={cx(styles.track, overflow && styles.filled)}
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
        {overflow && <div ref={thumbRef} className={styles.thumb} style={thumbStyle} {...thumbHandlers} />}
      </div>
      <ScrollArrow direction="down" hidden={!overflow} onStep={() => step(ARROW_STEP_PX)} />
      {resizeControl}
    </div>
  );
}
