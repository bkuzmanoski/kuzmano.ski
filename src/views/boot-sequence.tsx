import clsx from "clsx";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import DiskActivityIndicator from "#/assets/images/macintosh-disk-activity-indicator.svg?react";
import DisplayBackdrop from "#/assets/images/macintosh-display-backdrop.svg?react";
import DisplayGlassLayer from "#/assets/images/macintosh-display-glass-layer.svg?react";
import macintoshAvifUrl from "#/assets/images/macintosh.avif";
import macintoshWebpUrl from "#/assets/images/macintosh.webp";
import { SITE_NAME } from "#/config/site";
import { playBootChime, playDiskActivity } from "#/lib/audio/boot";
import { NON_GESTURE_KEYS, unlockAudio } from "#/lib/audio/context";
import { clearBootOverlay, setHasBooted, setIsBootSequenceComplete, shouldBoot } from "#/lib/boot";
import { PHOSPHOR_COLOR, screenParametersFor } from "#/lib/crt-effect";
import type { Bloom } from "#/lib/crt-effect";
import type { Inset, Rect, Size } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";
import { getPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion";

import styles from "./boot-sequence.module.css";

import type { CSSProperties } from "react";

type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

/* Metrics derived from the illustration, in its own coordinates. */
const CASE = { width: 1214, height: 1067 };
const VIEWABLE_AREA = { x: 330, y: 99, width: 554, height: 410 };
const DISK_LIGHT = { x: 890, y: 670, size: 6 };

/* Metrics scaled to the displayed size of the illustration. */
const VIEWABLE_AREA_FRACTION = {
  x: VIEWABLE_AREA.x / CASE.width,
  y: VIEWABLE_AREA.y / CASE.height,
  width: VIEWABLE_AREA.width / CASE.width,
  height: VIEWABLE_AREA.height / CASE.height,
};
const DISK_LIGHT_FRACTION = {
  x: DISK_LIGHT.x / CASE.width,
  y: DISK_LIGHT.y / CASE.height,
  size: DISK_LIGHT.size / CASE.width,
};

const SCREEN_FILTER_ID = "boot-screen";
const SCREEN_STYLE: StyleWithVars = { "--filter-url": `url(#${SCREEN_FILTER_ID})` };

/* Note: `phaseFlags` answers from a phase's position. Phases must be defined in sequence order. */
const PHASES = [
  "loading",
  "waiting-for-input",
  "macintosh-reveal",
  "display-on",
  "logo",
  "welcome-dialog",
  "glass-fade",
  "desktop-reveal",
  "complete",
] as const;

type Phase = (typeof PHASES)[number];

function phaseFlags(phase: Phase) {
  const step = PHASES.indexOf(phase);
  const from = (first: Phase) => step >= PHASES.indexOf(first);
  const before = (first: Phase) => step < PHASES.indexOf(first);

  return {
    isLoadingCoverUp: before("macintosh-reveal"),
    isWarmingUp: phase === "display-on",
    isDisplayOn: from("display-on"),
    isScreenTreated: from("display-on") && before("desktop-reveal"),
    isScreenContentVisible: from("logo") && before("glass-fade"),
    isShowingLogo: phase === "logo",
    isShowingWelcomeDialog: phase === "welcome-dialog",
    isPreparingToLeave: from("welcome-dialog"), // Used to apply `will-change` hints to the layers that will be animated out.
    isGlassHidden: from("glass-fade"),
    isRevealingDesktop: phase === "desktop-reveal",
  };
}

/* The motion the stylesheet animates over. */
const MOTION_MS = {
  loadingCoverFade: 600,
  crtWarmUp: 500,
  welcomeDialogDraw: 250,
  glassFade: 150,
  desktopReveal: 350, // Matches `--duration-desktop-reveal-step` in `styles.css`.
};

type Motion = typeof MOTION_MS;

/* Substituted under a reduced motion preference. */
const REDUCED_MOTION_MS: Motion = {
  ...MOTION_MS,
  crtWarmUp: 0,
  desktopReveal: 0,
};

const HOLD_MS = {
  illustrationReveal: 400,
  displayOn: 500,
  logo: 1400,
  welcomeDialog: 1400,
};

const sequence = (motion: Motion) =>
  [
    { phase: "macintosh-reveal", durationMs: motion.loadingCoverFade + HOLD_MS.illustrationReveal },
    { phase: "display-on", durationMs: motion.crtWarmUp + HOLD_MS.displayOn },
    { phase: "logo", durationMs: HOLD_MS.logo },
    { phase: "welcome-dialog", durationMs: motion.welcomeDialogDraw + HOLD_MS.welcomeDialog },
    { phase: "glass-fade", durationMs: motion.glassFade },
    { phase: "desktop-reveal", durationMs: motion.desktopReveal },
  ] as const satisfies ReadonlyArray<{ phase: Phase; durationMs: number }>;

interface Metrics {
  display: Rect; // The cutout in the illustration, in viewport coordinates.
  view: Size;
  pixelRatio: number;
}

const cssInset = (edges: Inset) => `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px`;

const isBeginKey = (event: KeyboardEvent) =>
  !event.altKey && !event.ctrlKey && !event.metaKey && !NON_GESTURE_KEYS.has(event.key);
const isTouchOnly = () => (window as Partial<Window>).matchMedia?.("(any-hover: none)").matches ?? false;

/** Resolves when required assets are loaded, or if the wait has been too long. */
async function whenReady(image: HTMLImageElement | null): Promise<unknown> {
  const illustrationImage = image?.decode ? image.decode().catch(() => undefined) : Promise.resolve();
  const fontSet = (document as Partial<Document>).fonts?.ready ?? Promise.resolve();

  let timer: ReturnType<typeof setTimeout> | undefined;

  const promises = Promise.all([illustrationImage, fontSet]);
  const timeout = new Promise((resolve) => (timer = setTimeout(resolve, MAX_LOADING_MS)));

  try {
    return await Promise.race([promises, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Exported for unit tests. */
export function viewableAreaOf(box: Rect): Rect {
  return {
    x: box.x + box.width * VIEWABLE_AREA_FRACTION.x,
    y: box.y + box.height * VIEWABLE_AREA_FRACTION.y,
    width: box.width * VIEWABLE_AREA_FRACTION.width,
    height: box.height * VIEWABLE_AREA_FRACTION.height,
  };
}

/**
 * Insets for a child of `box` that places its edges on the edges of the viewport.
 * Each edge is given its own distance to travel, so animating to them reaches all
 * four corners at the same time.
 *
 * Exported for unit tests.
 */
export function insetToViewport(box: Rect, view: Size): Inset {
  return {
    top: -box.y,
    right: box.x + box.width - view.width,
    bottom: box.y + box.height - view.height,
    left: -box.x,
  };
}

function ScreenFilter({ bloom }: { bloom: Bloom }) {
  return (
    <svg className={styles.filterDefinitions} aria-hidden>
      <filter id={SCREEN_FILTER_ID} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="luminance" />
        <feComponentTransfer in="luminance" result="highlights">
          <feFuncA type="table" tableValues={bloom.knee} />
        </feComponentTransfer>
        <feGaussianBlur in="highlights" stdDeviation={bloom.coreRadius} result="core" />
        <feGaussianBlur in="highlights" stdDeviation={bloom.haloRadius} result="wide" />
        <feComponentTransfer in="wide" result="halo">
          <feFuncA type="linear" slope={bloom.haloIntensity} />
        </feComponentTransfer>
        <feBlend in="core" in2="halo" mode="screen" result="haze" />
        <feComposite in="haze" in2="highlights" operator="out" result="spill" />
        <feFlood floodColor={PHOSPHOR_COLOR} result="phosphor" />
        <feComposite in="phosphor" in2="spill" operator="in" result="glow" />
        <feBlend in="SourceGraphic" in2="glow" mode="screen" />
      </filter>
    </svg>
  );
}

function Display({ metrics, phase }: { metrics: Metrics; phase: Phase }) {
  const { display, view, pixelRatio } = metrics;
  const {
    isLoadingCoverUp,
    isWarmingUp,
    isDisplayOn,
    isScreenTreated,
    isScreenContentVisible,
    isShowingLogo,
    isShowingWelcomeDialog,
    isPreparingToLeave,
    isGlassHidden,
    isRevealingDesktop,
  } = phaseFlags(phase);

  const scale = display.width / VIEWABLE_AREA.width;
  const screenParameters = screenParametersFor(display, scale, pixelRatio);
  const displayMaskStyle: StyleWithVars = {
    left: display.x,
    top: display.y,
    width: display.width,
    height: display.height,
    "--display-scale": scale,
    "--phosphor-color": PHOSPHOR_COLOR,
    "--screen-radius": `${screenParameters.radius}px`,
    "--scanline-pitch": `${screenParameters.scanlines.pitch}px`,
    "--scanline-alpha": screenParameters.scanlines.alpha,
    "--scanline-offset": `${screenParameters.scanlines.offset}px`,
    "--inset": cssInset(isRevealingDesktop ? insetToViewport(display, view) : screenParameters.inset),
  };
  const screenClipPath = isRevealingDesktop ? "none" : screenParameters.clipPath;

  return (
    <div
      className={clsx(styles.displayMask, isLoadingCoverUp && styles.hidden, isRevealingDesktop && styles.revealing)}
      style={displayMaskStyle}
    >
      <ScreenFilter bloom={screenParameters.bloom} />
      <DisplayBackdrop className={styles.display} />
      {isScreenTreated && <div className={clsx(styles.screenGlow, isGlassHidden && styles.leaving)} />}
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
          <div className={styles.screen} style={SCREEN_STYLE}>
            {isShowingLogo && <LogoIcon className={styles.logo} />}
            {isShowingWelcomeDialog && <p className={styles.welcomeDialog}>Welcome to {SITE_NAME}</p>}
          </div>
        )}
        {isScreenTreated && <div className={clsx(styles.crtOverlay, isGlassHidden && styles.leaving)} />}
        {isWarmingUp && <div className={styles.warmUpFlash} />}
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
      pixelRatio: window.devicePixelRatio || 1,
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

    /* Sound effects are scheduled against the audio clock rather than the phase timers, so the
     * disk drive head is heard stepping in time with the light however those timers land. */
    const displayOnDelaySeconds = phases[0].durationMs / 1000;
    const diskActivitySeconds =
      phases.reduce((total, { durationMs }) => total + durationMs, 0) / 1000 - displayOnDelaySeconds;

    playBootChime({ delaySeconds: displayOnDelaySeconds });
    playDiskActivity({ delaySeconds: displayOnDelaySeconds, seconds: diskActivitySeconds });

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

    void whenReady(illustrationImageRef.current).then(() => {
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
    "--welcome-dialog-draw-ms": `${motion.welcomeDialogDraw}ms`,
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
                left: `${DISK_LIGHT_FRACTION.x * 100}%`,
                top: `${DISK_LIGHT_FRACTION.y * 100}%`,
                width: `${DISK_LIGHT_FRACTION.size * 100}%`,
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
      <div className={clsx(styles.loadingMessageWrapper, !isLoadingCoverUp && styles.leaving)}>
        <div className={styles.loadingMessage}>
          {phase === "loading" ? (
            "Loading…"
          ) : (
            <>
              {beginPrompt}&nbsp;<span className={styles.block}>&#9608;</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const noSubscribe = () => () => {};
const serverShouldBoot = () => false;

export function BootSequence() {
  return useSyncExternalStore(noSubscribe, shouldBoot, serverShouldBoot) ? <Sequence /> : null;
}
