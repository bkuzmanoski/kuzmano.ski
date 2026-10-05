import { useEffect } from "react";

import { SCREENSAVER_IDLE_DELAY_MS } from "#/config/desktop.ts";
import { playKeyPressSounds } from "#/lib/audio/key-press-sounds.ts";
import { loadKeySounds } from "#/lib/audio/sounds.ts";
import { usePressSound } from "#/lib/audio/use-press-sound.ts";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/lifecycle.ts";
import { cx } from "#/lib/class-names.ts";
import { useIdleTimeout } from "#/lib/hooks/use-idle-timeout.ts";
import { usePrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import { isBrowserShortcut } from "#/lib/keys.ts";
import { mergeHandlers } from "#/lib/merge-handlers.ts";
import { FLOCK } from "#/lib/screensaver/flock.ts";
import { FADE_IN_DURATION_MS, sleepOnIdle, useSleepState, wake } from "#/lib/screensaver/lifecycle.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./screensaver.module.css";

import type { PointerEvent } from "react";

const SCREENSAVER_STYLE: StyleWithVars = { "--screensaver-fade-in-ms": `${FADE_IN_DURATION_MS}ms` };

function wakeOnMovement(event: PointerEvent<HTMLDivElement>) {
  if (event.buttons === 0) {
    wake();
  }
}

function interceptKeyEvent(event: KeyboardEvent) {
  event.stopPropagation();

  if (!isBrowserShortcut(event)) {
    event.preventDefault();
  }
}

function wakeOnKeyDown(event: KeyboardEvent) {
  if (!event.repeat) {
    playKeyPressSounds(event, { onRelease: interceptKeyEvent });
  }

  wake();
}

export function Screensaver() {
  const sleepState = useSleepState();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const prefersReducedMotion = usePrefersReducedMotion();
  const pressSoundHandlers = usePressSound();

  const isIdleSleepEnabled = isBootSequenceComplete && !prefersReducedMotion && sleepState === "awake";
  const isUp = sleepState !== "awake";
  const isDismissible = sleepState === "asleep";

  const dismissHandlers = isDismissible
    ? mergeHandlers(pressSoundHandlers, { onClick: wake, onPointerMove: wakeOnMovement })
    : undefined;

  useIdleTimeout(SCREENSAVER_IDLE_DELAY_MS, isIdleSleepEnabled, sleepOnIdle);

  useEffect(() => {
    if (isUp) {
      void loadKeySounds();
    }
  }, [isUp]);

  useEffect(() => {
    if (!isUp) {
      return;
    }

    const controller = new AbortController();

    window.addEventListener(
      "keydown",
      (event) => {
        interceptKeyEvent(event);

        if (isDismissible) {
          wakeOnKeyDown(event);
        }
      },
      { capture: true, signal: controller.signal },
    );

    return () => controller.abort();
  }, [isUp, isDismissible]);

  return (
    <div
      style={SCREENSAVER_STYLE}
      className={cx(styles.screensaver, isUp && styles.up)}
      aria-hidden
      {...dismissHandlers}
    >
      {isUp &&
        FLOCK.map(({ image, style }, index) => (
          <div key={index} className={cx(styles.sprite, styles[image])} style={style} />
        ))}
    </div>
  );
}
