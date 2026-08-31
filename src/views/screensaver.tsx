import { useEffect } from "react";

import { SCREENSAVER_IDLE_DELAY_MS } from "#/config/desktop";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/use-is-boot-sequence-complete";
import { cx } from "#/lib/class-names";
import { useIdleTimeout } from "#/lib/hooks/use-idle-timeout";
import { usePrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion";
import { FLOCK } from "#/lib/screensaver/flock";
import { FADE_IN_DURATION_MS, sleepOnIdle, useSleepState, wake } from "#/lib/screensaver/lifecycle";
import type { StyleWithVars } from "#/lib/style";

import styles from "./screensaver.module.css";

import type { PointerEvent } from "react";

const screensaverStyle: StyleWithVars = { "--fade-in-ms": `${FADE_IN_DURATION_MS}ms` };

function wakeOnMovement(event: PointerEvent<HTMLDivElement>) {
  if (event.buttons === 0) {
    wake();
  }
}

export function Screensaver() {
  const state = useSleepState();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const prefersReducedMotion = usePrefersReducedMotion();

  const isIdleSleepEnabled = isBootSequenceComplete && !prefersReducedMotion && state === "awake";
  const isUp = state !== "awake";
  const isDismissible = state === "asleep";

  useIdleTimeout(SCREENSAVER_IDLE_DELAY_MS, isIdleSleepEnabled, sleepOnIdle);

  useEffect(() => {
    if (!isDismissible) {
      return;
    }

    const controller = new AbortController();

    document.addEventListener("keydown", wake, { signal: controller.signal });

    return () => controller.abort();
  }, [isDismissible]);

  return (
    <div
      aria-hidden
      className={cx(styles.screensaver, isUp && styles.up)}
      style={screensaverStyle}
      onClick={isDismissible ? wake : undefined}
      onPointerMove={isDismissible ? wakeOnMovement : undefined}
    >
      {isUp &&
        FLOCK.map(({ image, style }, index) => (
          <div key={index} className={cx(styles.sprite, styles[image])} style={style} />
        ))}
    </div>
  );
}
