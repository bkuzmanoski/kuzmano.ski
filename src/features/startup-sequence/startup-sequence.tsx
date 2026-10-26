import { useEffect, useEffectEvent, useRef, useState } from "react";

import Logo from "#/assets/images/logo.svg?react";
import bodyMacintoshIllustrationAvifUrl from "#/assets/images/macintosh-illustration-body.avif";
import bodyMacintoshIllustrationWebpUrl from "#/assets/images/macintosh-illustration-body.webp";
import DiskActivityIndicatorMacintoshIllustration from "#/assets/images/macintosh-illustration-disk-activity-indicator.svg?react";
import DisplayBackdropMacintoshIllustration from "#/assets/images/macintosh-illustration-display-backdrop.svg?react";
import displayGlassLayerMacintoshIllustrationSvgUrl from "#/assets/images/macintosh-illustration-display-glass-layer.svg";
import keyboardMacintoshIllustrationAvifUrl from "#/assets/images/macintosh-illustration-keyboard.avif";
import keyboardMacintoshIllustrationWebpUrl from "#/assets/images/macintosh-illustration-keyboard.webp";
import { LoadingIndicator } from "#/components/loading-indicator.tsx";
import { needsAudioPriming, primeAudio } from "#/lib/audio/context.ts";
import { playKeyPressSounds } from "#/lib/audio/key-press-sounds.ts";
import { playKeyDownSound, playKeyPressSound, playKeyUpSound, playStartupChimeSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import { isTouchOnly } from "#/lib/device.ts";
import { insetFromViewport, insetToViewport } from "#/lib/geometry.ts";
import type { Inset, Size, Transform } from "#/lib/geometry.ts";
import { useClientValue } from "#/lib/hooks/use-client-value.ts";
import { getPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion.ts";
import { screenParametersFor } from "#/lib/startup-sequence/crt-display-effect.ts";
import { beginStartupSequence, completeStartupSequence } from "#/lib/startup-sequence/lifecycle.ts";
import { clearStartupSequenceThemeColor } from "#/lib/startup-sequence/overlay.ts";
import {
  MIN_LOADING_DURATION_MS,
  MOTION_DURATION_MS,
  REDUCED_MOTION_DURATION_MS,
  hasStageZoom,
  isBeginKey,
  phaseFlags,
  sequence,
  startOfPhaseMs,
  whenFontReady,
  whenIllustrationReady,
  whenKeySoundsReady,
} from "#/lib/startup-sequence/phases.ts";
import type { Motion, Phase } from "#/lib/startup-sequence/phases.ts";
import { shouldRunStartupSequence } from "#/lib/startup-sequence/session.ts";
import {
  DISK_ACTIVITY_INDICATOR_PLACEMENT,
  DISPLAY_BEZEL_INSET,
  FOCAL_POINT,
  KEYBOARD_PARALLAX,
  stageMetricsFor,
} from "#/lib/startup-sequence/stage.ts";
import type { StageMetrics } from "#/lib/startup-sequence/stage.ts";
import type { StyleWithVars } from "#/lib/style.ts";

import styles from "./startup-sequence.module.css";

const cssInset = (edges: Inset) => `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px`;
const cssTransform = ({ scale, x, y }: Transform) => `translate(${x}px, ${y}px) scale(${scale})`;
const cssParallaxTransform = ({ translate, scale }: typeof KEYBOARD_PARALLAX) =>
  `translate3d(${translate.x * 100}%, ${translate.y * 100}%, 0) scale3d(${scale.x}, ${scale.y}, 1)`;

const viewportSize = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

type CoverContent = "loadingIndicator" | "beginPrompt";

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
    "--startup-sequence-display-scale": scale,
    "--startup-sequence-screen-radius": `${screenParameters.radius}px`,
    "--startup-sequence-inset": cssInset(screenParameters.inset),
    "--startup-sequence-viewport-inset": cssInset(insetToViewport(display, viewport)),
    "--startup-sequence-inscribed-screen-inset": cssInset(insetFromViewport(screenParameters.inscribedBox, viewport)),
  };

  return (
    <div
      style={displayMaskStyle}
      className={cx(styles.displayMask, isLoadingCoverUp && styles.hidden, isRevealingDesktop && styles.revealing)}
      aria-hidden
    >
      <DisplayBackdropMacintoshIllustration className={styles.displayBackdropMacintoshIllustration} />
      <div
        className={cx(
          styles.display,
          !isDisplayOn && styles.hidden,
          isWarmingUp && styles.warmingUp,
          isGlassHidden && styles.coolingDown,
        )}
        style={{ clipPath: screenParameters.clipPath }}
      >
        {isScreenContentVisible && (
          <div className={cx(styles.screen, isGlassHidden && styles.leaving)}>
            <Logo className={styles.logo} />
          </div>
        )}
      </div>
      {isRevealingDesktop && <div className={styles.desktopWallpaper} />}
      {/* Use an image instead of inline SVG as WebKit repaints inline filters when the layer changes, dropping frames during reveals. */}
      <img
        alt=""
        src={displayGlassLayerMacintoshIllustrationSvgUrl}
        className={cx(
          styles.displayGlassLayerMacintoshIllustration,
          isPreparingToLeave && styles.preparingToLeave,
          isGlassHidden && styles.leaving,
        )}
      />
    </div>
  );
}

function StartupSequenceContent() {
  // Held for the whole run, so the durations the stylesheet animates over and the
  // timers for each phase do not disagree if the reduced motion preference changes.
  const [motion] = useState<Motion>(() =>
    getPrefersReducedMotion() ? REDUCED_MOTION_DURATION_MS : MOTION_DURATION_MS,
  );

  const [coverContent, setCoverContent] = useState<CoverContent>("loadingIndicator");
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
    const steps = sequence(motion);

    setPhase(steps[0].phase);
    playStartupChimeSound({ delaySeconds: startOfPhaseMs(steps, "display-on") / 1000 });

    let elapsedTimeMs = 0;

    return steps.map(({ durationMs }, index) => {
      const nextPhase: Phase = steps[index + 1]?.phase ?? "complete";

      elapsedTimeMs += durationMs;

      return setTimeout(() => {
        setPhase(nextPhase);

        if (nextPhase === "complete") {
          completeStartupSequence();
        }
      }, elapsedTimeMs);
    });
  });

  useEffect(() => {
    beginStartupSequence();

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const controller = new AbortController();

    const readinessPromises = [
      whenFontReady(),
      whenKeySoundsReady(),
      whenIllustrationReady(bodyImageRef.current, keyboardImageRef.current),
      new Promise((resolve) => timers.push(setTimeout(resolve, MIN_LOADING_DURATION_MS))),
    ];

    void Promise.all(readinessPromises).then(() => {
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
      document.addEventListener("pointerdown", onPointerDown, eventListenerOptions);
      document.addEventListener("pointerup", onPointerUp, eventListenerOptions);
    });

    let isMouseButtonPressed = false;

    function onKeyDown(event: KeyboardEvent) {
      if (!event.repeat && isBeginKey(event)) {
        primeAudio();
        playKeyPressSounds(event, { onRelease: runSequence, signal: controller.signal });
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse") {
        isMouseButtonPressed = true;
        primeAudio();
        playKeyDownSound();
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (event.pointerType === "mouse") {
        if (isMouseButtonPressed) {
          playKeyUpSound();
          runSequence();
        }

        return;
      }

      primeAudio();
      playKeyPressSound();
      runSequence();
    }

    function runSequence() {
      controller.abort();
      timers.push(...schedulePhaseExecution());
    }

    return () => {
      controller.abort();
      timers.forEach(clearTimeout);
      clearStartupSequenceThemeColor();
    };
  }, []);

  if (phase === "complete") {
    return null;
  }

  const {
    isLoadingCoverUp,
    isRevealingMacintosh,
    isZoomedOut,
    isPreparingToZoom,
    isDisplayOn,
    isPreparingToLeave,
    isRevealingDesktop,
  } = phaseFlags(phase);
  const hasZoom = hasStageZoom(motion);
  const containerStyle: StyleWithVars = {
    "--startup-sequence-macintosh-reveal-ms": `${motion.macintoshReveal}ms`,
    "--startup-sequence-stage-zoom-ms": `${motion.stageZoom}ms`,
    "--startup-sequence-crt-warm-up-ms": `${motion.crtWarmUp}ms`,
    "--startup-sequence-logo-reveal-ms": `${motion.logoReveal}ms`,
    "--startup-sequence-glass-fade-ms": `${motion.glassFade}ms`,
    "--startup-sequence-desktop-reveal-ms": `${motion.desktopReveal}ms`,
    "--startup-sequence-glow-origin-x": `${metrics.display.x + metrics.display.width / 2}px`,
    "--startup-sequence-glow-origin-y": `${metrics.display.y + metrics.display.height / 2}px`,
    "--startup-sequence-focal-point-x": `${FOCAL_POINT.x * 100}%`,
    "--startup-sequence-focal-point-y": `${FOCAL_POINT.y * 100}%`,
    "--startup-sequence-parallax-transform": cssParallaxTransform(KEYBOARD_PARALLAX),
  };
  const beginPrompt = isTouchOnly() ? "Tap to begin" : "Press any key to begin";
  const stageStyle: StyleWithVars = {
    "--startup-sequence-zoom-out": cssTransform(metrics.zoomOut),
  };
  const illustrationStyle = {
    left: metrics.illustration.x,
    top: metrics.illustration.y,
    width: metrics.illustration.width,
    height: metrics.illustration.height,
  };

  return (
    <div
      className={cx(
        styles.container,
        hasZoom && (isZoomedOut ? styles.zoomedOut : styles.zoomedIn),
        isRevealingMacintosh && styles.revealingMacintosh,
      )}
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
          <picture className={styles.bodyMacintoshIllustration}>
            <source srcSet={bodyMacintoshIllustrationAvifUrl} type="image/avif" />
            <img ref={bodyImageRef} alt="Illustration of a classic Mac 128K." src={bodyMacintoshIllustrationWebpUrl} />
          </picture>
          <DiskActivityIndicatorMacintoshIllustration
            style={{
              left: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.x * 100}%`,
              top: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.y * 100}%`,
              width: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.width * 100}%`,
              height: `${DISK_ACTIVITY_INDICATOR_PLACEMENT.height * 100}%`,
            }}
            className={cx(styles.diskActivityIndicatorMacintoshIllustration, isDisplayOn && styles.reading)}
            aria-hidden
          />
          <picture className={styles.keyboardMacintoshIllustration}>
            <source srcSet={keyboardMacintoshIllustrationAvifUrl} type="image/avif" />
            <img ref={keyboardImageRef} alt="" src={keyboardMacintoshIllustrationWebpUrl} />
          </picture>
        </div>
      </div>
      {isRevealingMacintosh && <div className={styles.macintoshRevealShade} />}
      {isLoadingCoverUp && (
        <>
          <div className={styles.loadingCover} />
          <div className={styles.loadingContent}>
            {coverContent === "loadingIndicator" ? (
              <LoadingIndicator />
            ) : (
              <div className={styles.prompt}>
                {beginPrompt}
                <span className={styles.block} aria-hidden />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function StartupSequence() {
  return useClientValue(false, shouldRunStartupSequence) ? <StartupSequenceContent /> : null;
}
