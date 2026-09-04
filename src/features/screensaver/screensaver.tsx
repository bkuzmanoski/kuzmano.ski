import { useEffect } from "react";

import { SCREENSAVER_IDLE_DELAY_MS } from "#/config/desktop.ts";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/lifecycle.ts";
import { cx } from "#/lib/class-names.ts";
import { useIdleTimeout } from "#/lib/hooks/use-idle-timeout.ts";
import { usePrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import { FLOCK } from "#/lib/screensaver/flock.ts";
import { FADE_IN_DURATION_MS, sleepOnIdle, useSleepState, wake } from "#/lib/screensaver/lifecycle.ts";
import type { StyleWithVars } from "#/lib/style.ts";

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
      style={screensaverStyle}
      className={cx(styles.screensaver, isUp && styles.up)}
      aria-hidden
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
