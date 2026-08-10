import clsx from "clsx";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import DiskActivityIndicator from "#/assets/images/macintosh-disk-activity-indicator.svg?react";
import DisplayBackdrop from "#/assets/images/macintosh-display-backdrop.svg?react";
import DisplayGlassLayer from "#/assets/images/macintosh-display-glass-layer.svg?react";
import macintoshAvifUrl from "#/assets/images/macintosh.avif";
import macintoshWebpUrl from "#/assets/images/macintosh.webp";
import { Spinner } from "#/components/spinner";
import { playBootChime } from "#/lib/audio/boot-chime";
import { unlockAudio } from "#/lib/audio/context";
import { clearBootOverlay, setHasBooted, setIsBootSequenceComplete, shouldBoot } from "#/lib/boot";
import {
  MINIMUM_LOADING_MS,
  MOTION_MS,
  REDUCED_MOTION_MS,
  isBeginKey,
  isTouchOnly,
  phaseFlags,
  sequence,
  whenFontsReady,
  whenIllustrationReady,
} from "#/lib/boot-sequence";
import type { Motion, Phase } from "#/lib/boot-sequence";
import { screenParametersFor } from "#/lib/crt-effect";
import { insetToViewport } from "#/lib/geometry";
import type { Inset, Rect, Size } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";
import { getPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion";
import { DISK_ACTIVITY_INDICATOR_PLACEMENT, VIEWABLE_AREA, viewableAreaOf } from "#/lib/macintosh-illustration";
import { noSubscribe } from "#/lib/store";
import type { StyleWithVars } from "#/lib/style";

import styles from "./boot-sequence.module.css";

interface Metrics {
  display: Rect; // The cutout in the illustration, in viewport coordinates.
  view: Size;
}

const cssInset = (edges: Inset) => `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px`;

function Display({ metrics, phase }: { metrics: Metrics; phase: Phase }) {
  const { display, view } = metrics;
  const {
    isLoadingCoverUp,
    isWarmingUp,
    isDisplayOn,
    isScreenContentVisible,
    isPreparingToLeave,
    isGlassHidden,
    isRevealingDesktop,
  } = phaseFlags(phase);

  const scale = display.width / VIEWABLE_AREA.width;
  const screenParameters = screenParametersFor(display, scale);
  const displayMaskStyle: StyleWithVars = {
    left: display.x,
    top: display.y,
    width: display.width,
    height: display.height,
    "--display-scale": scale,
    "--screen-radius": `${screenParameters.radius}px`,
    "--inset": cssInset(isRevealingDesktop ? insetToViewport(display, view) : screenParameters.inset),
  };
  const screenClipPath = isRevealingDesktop ? "none" : screenParameters.clipPath;

  return (
    <div
      className={clsx(styles.displayMask, isLoadingCoverUp && styles.hidden, isRevealingDesktop && styles.revealing)}
      style={displayMaskStyle}
    >
      <DisplayBackdrop className={styles.display} />
      <div
        className={clsx(
          styles.viewableArea,
          !isDisplayOn && styles.hidden,
          isWarmingUp && styles.warmingUp,
          isRevealingDesktop && styles.growing,
        )}
        style={{ clipPath: screenClipPath }}
      >
        {isScreenContentVisible && (
          <div className={clsx(styles.screen, isGlassHidden && styles.leaving)}>
            <LogoIcon className={styles.logo} />
          </div>
        )}
      </div>
      <DisplayGlassLayer
        className={clsx(
          styles.glassOverlay,
          isPreparingToLeave && styles.preparingToLeave,
          isGlassHidden && styles.leaving,
        )}
      />
    </div>
  );
}

function Sequence() {
  /* Held for the whole run, so the durations the stylesheet animates over and the
   * timers for each phase do not disagree if the reduced motion preference changes. */
  const [motion] = useState<Motion>(() => (getPrefersReducedMotion() ? REDUCED_MOTION_MS : MOTION_MS));

  const [phase, setPhase] = useState<Phase>("loading");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const illustrationImageRef = useRef<HTMLImageElement>(null);
  const illustrationImageSize = useElementSize(illustrationImageRef);

  const updateMetrics = useEffectEvent(() => {
    const element = illustrationImageRef.current;

    if (!element) {
      return;
    }

    const box = element.getBoundingClientRect();

    if (box.width === 0) {
      return;
    }

    setMetrics({
      display: viewableAreaOf(box),
      view: { width: window.innerWidth, height: window.innerHeight },
    });
  });

  useEffect(() => {
    updateMetrics();
  }, [illustrationImageSize]);

  useEffect(() => {
    const resizing = new AbortController();

    window.addEventListener("resize", updateMetrics, { signal: resizing.signal });

    return () => resizing.abort();
  }, []);

  const startSequence = useEffectEvent(() => {
    const phases = sequence(motion);

    setPhase(phases[0].phase);
    playBootChime({ delaySeconds: phases[0].durationMs / 1000 });

    let elapsedMs = 0;

    return phases.map(({ durationMs }, index) => {
      const nextPhase: Phase = phases[index + 1]?.phase ?? "complete";

      elapsedMs += durationMs;

      return setTimeout(() => {
        setPhase(nextPhase);

        if (nextPhase === "complete") {
          setIsBootSequenceComplete();
        }
      }, elapsedMs);
    });
  });

  useEffect(() => {
    setHasBooted();
    clearBootOverlay();

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const waitingForInput = new AbortController();

    const loading = [
      whenFontsReady(),
      whenIllustrationReady(illustrationImageRef.current),
      new Promise((resolve) => timers.push(setTimeout(resolve, MINIMUM_LOADING_MS))),
    ];

    void Promise.all(loading).then(() => {
      if (waitingForInput.signal.aborted) {
        return;
      }

      setPhase("waiting-for-input");

      const eventListenerOptions = { capture: true, signal: waitingForInput.signal };

      document.addEventListener("keydown", onKeyDown, eventListenerOptions);
      document.addEventListener("pointerup", runSequence, eventListenerOptions);
    });

    function onKeyDown(event: KeyboardEvent) {
      if (isBeginKey(event)) {
        runSequence();
      }
    }

    function runSequence() {
      unlockAudio();
      waitingForInput.abort();
      timers.push(...startSequence());
    }

    return () => {
      waitingForInput.abort();
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "complete") {
    return null;
  }

  const { isLoadingCoverUp, isDisplayOn, isPreparingToLeave, isRevealingDesktop } = phaseFlags(phase);
  const containerStyle: StyleWithVars = {
    "--loading-cover-fade-ms": `${motion.loadingCoverFade}ms`,
    "--crt-warm-up-ms": `${motion.crtWarmUp}ms`,
    "--logo-draw-ms": `${motion.logoDraw}ms`,
    "--glass-fade-ms": `${motion.glassFade}ms`,
    "--desktop-reveal-ms": `${motion.desktopReveal}ms`,
  };
  const beginPrompt = isTouchOnly() ? "Tap to begin" : "Press any key to begin";

  return (
    <div className={styles.container} style={containerStyle}>
      {metrics && <Display metrics={metrics} phase={phase} />}
      <div className={styles.stage}>
        <div
          className={clsx(
            styles.illustration,
            isLoadingCoverUp && styles.hidden,
            isPreparingToLeave && styles.preparingToLeave,
            isRevealingDesktop && styles.leaving,
          )}
        >
          <div className={styles.spotlight} />
          <div className={styles.illustrationBody}>
            <DiskActivityIndicator
              className={clsx(styles.diskActivityIndicator, isDisplayOn && styles.reading)}
              style={{
                left: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.x * 100}%`,
                top: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.y * 100}%`,
                width: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.size * 100}%`,
              }}
            />
            <picture>
              <source srcSet={macintoshAvifUrl} type="image/avif" />
              <img ref={illustrationImageRef} alt="Illustration of a classic Mac 128K." src={macintoshWebpUrl} />
            </picture>
          </div>
        </div>
      </div>
      <div className={clsx(styles.loadingCover, !isLoadingCoverUp && styles.leaving)} />
      <div className={clsx(styles.loadingContent, !isLoadingCoverUp && styles.leaving)}>
        {phase === "loading" ? (
          <Spinner className={styles.spinner} />
        ) : (
          <div className={styles.prompt}>
            {beginPrompt}
            <span className={styles.block} aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}

const serverShouldBoot = () => false;

export function BootSequence() {
  return useSyncExternalStore(noSubscribe, shouldBoot, serverShouldBoot) ? <Sequence /> : null;
}
