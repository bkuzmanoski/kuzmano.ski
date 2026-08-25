import { useRef, useState } from "react";

import ArrowIcon from "#/assets/images/scroll-arrow.svg?react";
import { stepScroll } from "#/lib/audio/scroll";
import { playClick } from "#/lib/audio/sounds";
import { cx } from "#/lib/class-names";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag";
import type { ScrollMetrics } from "#/lib/hooks/use-scroll-metrics";
import { useTimer } from "#/lib/hooks/use-timer";
import { isActivationKey } from "#/lib/keys";
import { clamp } from "#/lib/math";
import { isPrimaryPress } from "#/lib/press";
import type { StyleWithVars } from "#/lib/style";

import styles from "./scrollbar.module.css";

import type { ReactNode, PointerEvent as ReactPointerEvent, RefObject } from "react";

const STEP = 40;
const REPEAT_DELAY_MS = 400; // The hold a repeat waits out. An ordinary click outlasts the interval below, so without this it steps twice.
const REPEAT_MS = 90;

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

  // Also run on unmount, so the repeat is cancelled if the scrollbar goes away mid-press.
  function stop() {
    setIsPressed(false);
    repeatTimer.cancel();
  }

  // The scroll itself carries the sound so press at the end of the travel has to be heard on its own.
  function step(isRepeat = false) {
    if (!onStep() && !isRepeat) {
      playClick();
    }
  }

  // A held arrow waits out `REPEAT_DELAY_MS` before it starts repeating, then repeats
  // every `REPEAT_MS`. One timer rescheduling itself keeps the two rates to one handle,
  // so a release cancels whichever is pending.
  function scheduleRepeat(delay: number) {
    const repeat = () => {
      step(true);
      repeatTimer.start(repeat, REPEAT_MS);
    };

    repeatTimer.start(repeat, delay);
  }

  function start(event: ReactPointerEvent) {
    if (!isPrimaryPress(event)) {
      return;
    }

    setIsPressed(true);
    step();
    scheduleRepeat(REPEAT_DELAY_MS);
  }

  return (
    <button
      type="button"
      aria-label={direction === "up" ? "Scroll up" : "Scroll down"}
      tabIndex={hidden ? -1 : undefined}
      className={cx(styles.arrow, direction === "up" ? styles.arrowUp : styles.arrowDown, hidden && styles.hidden)}
      onBlur={stop}
      onKeyDown={(event) => {
        if (!isActivationKey(event.key)) {
          return;
        }

        // Held down, the key repeat drives the repeat, so no timer is started here.
        // The default is suppressed because both keys raise a click of their own,
        // which would step the viewport a second time for every press.
        event.preventDefault();
        setIsPressed(true);
        step(event.repeat);
      }}
      onKeyUp={(event) => {
        if (isActivationKey(event.key)) {
          stop();
        }
      }}
      onPointerDown={start}
      onPointerLeave={stop}
      onPointerUp={stop}
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
    start: () => ({
      top: metrics.top,
      travel: (trackRef.current?.clientHeight ?? 0) - (thumbRef.current?.clientHeight ?? 0),
    }),
    onDragMove: (delta, from) => {
      if (viewportRef.current && from.travel > 0) {
        viewportRef.current.scrollTop = from.top + (delta.dy / from.travel) * range;
      }
    },
  });

  const step = (delta: number) => (viewportRef.current ? stepScroll(viewportRef.current, delta) : false);

  const isCollapsed = !overflow && !resizeControl;

  return (
    // The state is an attribute rather than a class so that the pane around it can
    // read it and hand the width back to its content (see `window.module.css`).
    <div className={cx(styles.scrollbar, className)} data-collapsed={isCollapsed || undefined}>
      <ScrollArrow direction="up" hidden={!overflow} onStep={() => step(-STEP)} />
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
      <ScrollArrow direction="down" hidden={!overflow} onStep={() => step(STEP)} />
      {resizeControl}
    </div>
  );
}
