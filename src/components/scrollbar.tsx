import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

import ScrollArrowIcon from "#/assets/images/scroll-arrow.svg?react";
import { playClick } from "#/lib/audio/ui";
import { useElementSize } from "#/lib/hooks/use-element-size";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag";

import styles from "./scrollbar.module.css";

import type { ReactNode, RefObject } from "react";

const STEP = 40;
const MIN_THUMB_HEIGHT = 20;
const REPEAT_MS = 90;

export interface ScrollMetrics {
  top: number;
  scrollHeight: number;
  clientHeight: number;
}

const isStepKey = (key: string) => key === "Enter" || key === " ";

function Arrow({ direction, hidden, onStep }: { direction: "up" | "down"; hidden: boolean; onStep: () => boolean }) {
  const [isPressed, setIsPressed] = useState(false);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stop() {
    setIsPressed(false);

    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  }

  function step() {
    /* The scroll itself carries the sound. A press at the end of the
     * travel moves nothing, so the press has to be heard on its own. */
    if (!onStep()) {
      playClick();
    }
  }

  function start() {
    setIsPressed(true);
    step();

    repeatTimerRef.current = setInterval(onStep, REPEAT_MS);
  }

  // Cancel repeat if the scrollbar goes away mid-press.
  useEffect(() => () => stop(), []);

  return (
    <button
      aria-label={direction === "up" ? "Scroll up" : "Scroll down"}
      className={clsx(styles.arrow, direction === "up" ? styles.arrowUp : styles.arrowDown, hidden && styles.hidden)}
      tabIndex={hidden ? -1 : undefined}
      type="button"
      onBlur={stop}
      onKeyDown={(event) => {
        if (!isStepKey(event.key)) {
          return;
        }

        /* Held down, the key repeat drives the repeat, so no timer is started here.
         * The default is suppressed because both keys raise a click of their own,
         * which would step the viewport a second time for every press. */
        event.preventDefault();
        setIsPressed(true);
        step();
      }}
      onKeyUp={(event) => {
        if (isStepKey(event.key)) {
          stop();
        }
      }}
      onPointerDown={start}
      onPointerLeave={stop}
      onPointerUp={stop}
    >
      <ScrollArrowIcon
        className={clsx(styles.arrowIcon, direction === "down" && styles.down, isPressed && styles.filled)}
      />
    </button>
  );
}

export function useScrollMetrics(ref: RefObject<HTMLElement | null>) {
  const [metrics, setMetrics] = useState<ScrollMetrics>({ top: 0, scrollHeight: 0, clientHeight: 0 });
  const size = useElementSize(ref);

  const measure = useCallback(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    setMetrics((current) =>
      current.top === element.scrollTop &&
      current.scrollHeight === element.scrollHeight &&
      current.clientHeight === element.clientHeight
        ? current
        : { top: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight },
    );
  }, [ref]);

  useEffect(() => {
    measure();
  }, [size, measure]);

  useEffect(() => {
    const element = ref.current;

    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    let frame: number | null = null;

    const schedule = () => {
      frame ??= requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };

    const resizeObserver = new ResizeObserver(schedule);

    const observeChildren = () => {
      for (const child of element.children) {
        resizeObserver.observe(child);
      }
    };

    observeChildren();

    let mutationObserver: MutationObserver | undefined;

    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(() => {
        observeChildren();
        schedule();
      });
      mutationObserver.observe(element, { childList: true });
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver?.disconnect();

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [ref, measure]);

  return { metrics, measure };
}

export function Scrollbar({
  controls,
  metrics,
  onStep,
  onScrollTop,
  resizeControl,
}: {
  controls: string; // The id of the viewport this scrolls.
  metrics: ScrollMetrics;
  onStep: (delta: number) => boolean; // Whether the viewport moved.
  onScrollTop: (top: number) => void;
  resizeControl?: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { height: trackHeight } = useElementSize(trackRef);

  const overflow = metrics.scrollHeight > metrics.clientHeight + 1;
  const range = metrics.scrollHeight - metrics.clientHeight;
  const thumbHeight = Math.max(MIN_THUMB_HEIGHT, (metrics.clientHeight / metrics.scrollHeight) * trackHeight);
  const thumbTop = range > 0 ? (metrics.top / range) * (trackHeight - thumbHeight) : 0;
  const isAtTop = thumbTop <= 0.5;
  const isAtBottom = thumbTop + thumbHeight >= trackHeight - 0.5;
  const scrolled = range > 0 ? Math.round((metrics.top / range) * 100) : 0;

  const thumbHandlers = usePointerDrag({
    preventDefault: true,
    start: () => metrics.top,
    onStart: (delta, startTop) => {
      if (trackHeight <= thumbHeight) {
        return;
      }

      onScrollTop(startTop + (delta.dy / (trackHeight - thumbHeight)) * range);
    },
  });

  return (
    <div className={styles.scrollbar}>
      <Arrow direction="up" hidden={!overflow} onStep={() => onStep(-STEP)} />
      <div
        ref={trackRef}
        aria-controls={controls}
        aria-label="Vertical scrollbar"
        aria-orientation="vertical"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={scrolled}
        aria-valuetext={`${scrolled}% scrolled`}
        className={clsx(styles.track, overflow && styles.filled)}
        role="scrollbar"
      >
        {overflow && (
          <div
            className={styles.thumb}
            style={{
              top: thumbTop,
              height: thumbHeight,
              borderTopWidth: isAtTop ? 0 : undefined,
              borderBottomWidth: isAtBottom ? 0 : undefined,
            }}
            {...thumbHandlers}
          />
        )}
      </div>
      <Arrow direction="down" hidden={!overflow} onStep={() => onStep(STEP)} />
      {resizeControl}
    </div>
  );
}
