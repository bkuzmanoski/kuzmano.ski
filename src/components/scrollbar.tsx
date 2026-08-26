import { useEffect, useRef, useState } from "react";

import ArrowIcon from "#/assets/images/scroll-arrow.svg?react";
import { stepScroll } from "#/lib/audio/scroll";
import { playClick } from "#/lib/audio/sounds";
import { cx } from "#/lib/class-names";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import type { ScrollMetrics } from "#/lib/hooks/use-scroll-metrics";
import { useTimer } from "#/lib/hooks/use-timer";
import { clamp } from "#/lib/math";
import { isPointerClick, isPrimaryPress } from "#/lib/press";
import type { StyleWithVars } from "#/lib/style";

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

    // A click event only follows a release on the arrow. If the release happens elsewhere,
    // the press has no click to consume it, so it must not affect the next activation.
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
      aria-label={direction === "up" ? "Scroll up" : "Scroll down"}
      tabIndex={hidden ? -1 : undefined}
      className={cx(styles.arrow, direction === "up" ? styles.arrowUp : styles.arrowDown, hidden && styles.hidden)}
      // Keyboard activation produces a click without a preceding pointer press, so it steps
      // here. A pointer click belongs to the press that already stepped on pointerdown and
      // only needs to clear that press. iOS can deliver a tap's click without its touch
      // pointer events reaching the arrow, so such a click must step here too.
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
  viewportRef: RefObject<HTMLElement | null>; // The viewport this scrolls.
  viewportId: string; // The id of the viewport this scrolls.
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

  const thumbHandlers = usePointerDrag({
    preventDefault: true,
    start: () => {
      playClick();

      return {
        top: metrics.top,
        travel: (trackRef.current?.clientHeight ?? 0) - (thumbRef.current?.clientHeight ?? 0),
      };
    },
    onDragMove: (delta, from) => {
      if (viewportRef.current && from.travel > 0) {
        viewportRef.current.scrollTop = from.top + (delta.dy / from.travel) * range;
      }
    },
  });

  const step = (delta: number) => (viewportRef.current ? stepScroll(viewportRef.current, delta) : false);

  const isCollapsed = !overflow && !resizeControl;

  return (
    <div className={cx(styles.scrollbar, className)} data-collapsed={isCollapsed || undefined}>
      <ScrollArrow direction="up" hidden={!overflow} onStep={() => step(-ARROW_STEP_PX)} />
      <div
        ref={trackRef}
        aria-controls={viewportId}
        aria-label="Vertical scrollbar"
        aria-orientation="vertical"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={scrolledPercent}
        aria-valuetext={`${scrolledPercent}% scrolled`}
        className={cx(styles.track, overflow && styles.filled)}
        role="scrollbar"
      >
        {overflow && <div ref={thumbRef} className={styles.thumb} style={thumbStyle} {...thumbHandlers} />}
      </div>
      <ScrollArrow direction="down" hidden={!overflow} onStep={() => step(ARROW_STEP_PX)} />
      {resizeControl}
    </div>
  );
}
