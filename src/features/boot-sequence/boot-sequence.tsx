import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import macintoshBodyAvifUrl from "#/assets/images/macintosh-body.avif";
import macintoshBodyWebpUrl from "#/assets/images/macintosh-body.webp";
import DiskActivityIndicator from "#/assets/images/macintosh-disk-activity-indicator.svg?react";
import DisplayBackdrop from "#/assets/images/macintosh-display-backdrop.svg?react";
import DisplayGlassLayer from "#/assets/images/macintosh-display-glass-layer.svg?react";
import macintoshKeyboardAvifUrl from "#/assets/images/macintosh-keyboard.avif";
import macintoshKeyboardWebpUrl from "#/assets/images/macintosh-keyboard.webp";
import { Spinner } from "#/components/spinner.tsx";
import { needsAudioPriming, primeAudio } from "#/lib/audio/context.ts";
import { playBootChime } from "#/lib/audio/sounds.ts";
import { screenParametersFor } from "#/lib/boot-sequence/crt-display-effect.ts";
import { beginBootSequence, completeBootSequence } from "#/lib/boot-sequence/lifecycle.ts";
import { clearBootSequenceThemeColor } from "#/lib/boot-sequence/overlay.ts";
import {
  MINIMUM_LOADING_DURATION_MS,
  MOTION_DURATION_MS,
  REDUCED_MOTION_DURATION_MS,
  hasStageZoom,
  isBeginKey,
  phaseFlags,
  sequence,
  startOfPhaseMs,
  whenFontReady,
  whenIllustrationReady,
} from "#/lib/boot-sequence/phases.ts";
import type { Motion, Phase } from "#/lib/boot-sequence/phases.ts";
import { shouldRunBootSequence } from "#/lib/boot-sequence/session.ts";
import {
  DISK_ACTIVITY_INDICATOR_PLACEMENT,
  DISPLAY_BEZEL_INSET,
  FOCAL_POINT,
  stageMetricsFor,
} from "#/lib/boot-sequence/stage.ts";
import type { StageMetrics } from "#/lib/boot-sequence/stage.ts";
import { cx } from "#/lib/class-names.ts";
import { isTouchOnly } from "#/lib/device.ts";
import { noSubscribe } from "#/lib/emitter.ts";
import { insetToViewport } from "#/lib/geometry.ts";
import type { Inset, Size, Transform } from "#/lib/geometry.ts";
import { getPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./boot-sequence.module.css";

const cssInset = (edges: Inset) => `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px`;
const cssTransform = ({ scale, x, y }: Transform) => `translate(${x}px, ${y}px) scale(${scale})`;

const viewportSize = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

type CoverContent = "spinner" | "beginPrompt";

function Display({ metrics, phase }: { metrics: StageMetrics; phase: Phase }) {
  const { display, scale, viewport } = metrics;
  const {
    isLoadingCoverUp,
    isWarmingUp,
    isDisplayOn,
    isScreenContentVisible,
    isPreparingToLeave,
    isGlassHidden,
    isRevealingDesktop,
  } = phaseFlags(phase);

  const screenParameters = screenParametersFor(display, DISPLAY_BEZEL_INSET, scale);
  const displayMaskStyle: StyleWithVars = {
    left: display.x,
    top: display.y,
    width: display.width,
    height: display.height,
    "--display-scale": scale,
    "--screen-radius": `${screenParameters.radius}px`,
    "--inset": cssInset(isRevealingDesktop ? insetToViewport(display, viewport) : screenParameters.inset),
  };
  const screenClipPath = isRevealingDesktop ? "none" : screenParameters.clipPath;

  return (
    <div
      style={displayMaskStyle}
      className={cx(styles.displayMask, isLoadingCoverUp && styles.hidden, isRevealingDesktop && styles.revealing)}
      aria-hidden
    >
      <DisplayBackdrop className={styles.displayBackdrop} />
      <div
        className={cx(
          styles.display,
          !isDisplayOn && styles.hidden,
          isWarmingUp && styles.warmingUp,
          isGlassHidden && styles.coolingDown,
          isRevealingDesktop && styles.growing,
        )}
        style={{ clipPath: screenClipPath }}
      >
        {isScreenContentVisible && (
          <div className={cx(styles.screen, isGlassHidden && styles.leaving)}>
            <LogoIcon className={styles.logo} />
          </div>
        )}
      </div>
      <DisplayGlassLayer
        className={cx(
          styles.glassOverlay,
          isPreparingToLeave && styles.preparingToLeave,
          isGlassHidden && styles.leaving,
        )}
      />
    </div>
  );
}

function Sequence() {
  // Held for the whole run, so the durations the stylesheet animates over and the
  // timers for each phase do not disagree if the reduced motion preference changes.
  const [motion] = useState<Motion>(() =>
    getPrefersReducedMotion() ? REDUCED_MOTION_DURATION_MS : MOTION_DURATION_MS,
  );

  const [coverContent, setCoverContent] = useState<CoverContent>("spinner");
  const [phase, setPhase] = useState<Phase>("loading");
  const [metrics, setMetrics] = useState<StageMetrics>(() => stageMetricsFor(viewportSize()));
  const bodyImageRef = useRef<HTMLImageElement>(null);
  const keyboardImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const updateMetrics = () => setMetrics(stageMetricsFor(viewportSize()));

    window.addEventListener("resize", updateMetrics, { signal: controller.signal });

    return () => controller.abort();
  }, []);

  const schedulePhaseExecution = useEffectEvent(() => {
    const phases = sequence(motion);

    setPhase(phases[0].phase);
    playBootChime({ delaySeconds: startOfPhaseMs(phases, "display-on") / 1000 });

    let elapsedTimeMs = 0;

    return phases.map(({ durationMs }, index) => {
      const nextPhase: Phase = phases[index + 1]?.phase ?? "complete";

      elapsedTimeMs += durationMs;

      return setTimeout(() => {
        setPhase(nextPhase);

        if (nextPhase === "complete") {
          completeBootSequence();
        }
      }, elapsedTimeMs);
    });
  });

  useEffect(() => {
    beginBootSequence();

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const controller = new AbortController();

    const loading = [
      whenFontReady(),
      whenIllustrationReady(bodyImageRef.current, keyboardImageRef.current),
      new Promise((resolve) => timers.push(setTimeout(resolve, MINIMUM_LOADING_DURATION_MS))),
    ];

    void Promise.all(loading).then(() => {
      if (controller.signal.aborted) {
        return;
      }

      if (!needsAudioPriming()) {
        runSequence();
        return;
      }

      setPhase("waiting-for-input");
      setCoverContent("beginPrompt");

      const eventListenerOptions = { capture: true, signal: controller.signal };

      document.addEventListener("keydown", onKeyDown, eventListenerOptions);
      document.addEventListener("pointerup", runSequence, eventListenerOptions);
    });

    function onKeyDown(event: KeyboardEvent) {
      if (isBeginKey(event)) {
        runSequence();
      }
    }

    function runSequence() {
      primeAudio();
      controller.abort();
      timers.push(...schedulePhaseExecution());
    }

    return () => {
      controller.abort();
      timers.forEach(clearTimeout);
      clearBootSequenceThemeColor();
    };
  }, []);

  if (phase === "complete") {
    return null;
  }

  const { isLoadingCoverUp, isZoomedOut, isPreparingToZoom, isDisplayOn, isPreparingToLeave, isRevealingDesktop } =
    phaseFlags(phase);
  const hasZoom = hasStageZoom(motion);
  const containerStyle: StyleWithVars = {
    "--loading-cover-fade-ms": `${motion.loadingCoverFade}ms`,
    "--stage-zoom-ms": `${motion.stageZoom}ms`,
    "--crt-warm-up-ms": `${motion.crtWarmUp}ms`,
    "--logo-draw-ms": `${motion.logoDraw}ms`,
    "--glass-fade-ms": `${motion.glassFade}ms`,
    "--desktop-reveal-ms": `${motion.desktopReveal}ms`,
    "--glow-origin-x": `${metrics.display.x + metrics.display.width / 2}px`,
    "--glow-origin-y": `${metrics.display.y + metrics.display.height / 2}px`,
    "--focal-point-x": `${FOCAL_POINT.x * 100}%`,
    "--focal-point-y": `${FOCAL_POINT.y * 100}%`,
  };
  const beginPrompt = isTouchOnly() ? "Tap to begin" : "Press any key to begin";
  const stageStyle: StyleWithVars = {
    "--zoom-out": cssTransform(metrics.zoomOut),
  };
  const illustrationStyle = {
    left: metrics.illustration.x,
    top: metrics.illustration.y,
    width: metrics.illustration.width,
    height: metrics.illustration.height,
  };

  return (
    <div
      className={cx(styles.container, hasZoom && (isZoomedOut ? styles.zoomedOut : styles.zoomedIn))}
      style={containerStyle}
    >
      <div className={styles.glow} />
      <div
        className={cx(
          styles.stage,
          hasZoom && isZoomedOut && styles.zoomedOut,
          hasZoom && isPreparingToZoom && styles.preparingToZoom,
        )}
        style={stageStyle}
      >
        <Display metrics={metrics} phase={phase} />
        <div
          className={cx(
            styles.illustration,
            isLoadingCoverUp && styles.hidden,
            isPreparingToLeave && styles.preparingToLeave,
            isRevealingDesktop && styles.leaving,
          )}
          style={illustrationStyle}
        >
          <picture className={styles.bodyLayer}>
            <source srcSet={macintoshBodyAvifUrl} type="image/avif" />
            <img ref={bodyImageRef} alt="Illustration of a classic Mac 128K." src={macintoshBodyWebpUrl} />
          </picture>
          <DiskActivityIndicator
            style={{
              left: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.x * 100}%`,
              top: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.y * 100}%`,
              width: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.width * 100}%`,
              height: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.height * 100}%`,
            }}
            className={cx(styles.diskActivityIndicator, isDisplayOn && styles.reading)}
            aria-hidden
          />
          <picture className={styles.keyboardLayer}>
            <source srcSet={macintoshKeyboardAvifUrl} type="image/avif" />
            <img ref={keyboardImageRef} alt="" src={macintoshKeyboardWebpUrl} />
          </picture>
        </div>
      </div>
      <div className={cx(styles.loadingCover, !isLoadingCoverUp && styles.leaving)} />
      <div className={cx(styles.loadingContent, !isLoadingCoverUp && styles.leaving)}>
        {coverContent === "spinner" ? (
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

const serverShouldRunBootSequence = () => false;

export function BootSequence() {
  return useSyncExternalStore(noSubscribe, shouldRunBootSequence, serverShouldRunBootSequence) ? <Sequence /> : null;
}
