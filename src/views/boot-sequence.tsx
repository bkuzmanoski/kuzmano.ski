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
import { NON_GESTURE_KEYS, unlockAudio } from "#/lib/audio/context";
import { clearBootOverlay, setHasBooted, setIsBootSequenceComplete, shouldBoot } from "#/lib/boot";
import { PHOSPHOR_COLOR, screenParametersFor } from "#/lib/crt-effect";
import type { Bloom } from "#/lib/crt-effect";
import { insetToViewport } from "#/lib/geometry";
import type { Inset, Rect, Size } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";
import { getPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion";
import { DISK_ACTIVITY_INDICATOR_PLACEMENT, VIEWABLE_AREA, viewableAreaOf } from "#/lib/macintosh-illustration";
import type { StyleWithVars } from "#/lib/style";

import styles from "./boot-sequence.module.css";

/* Note: `phaseFlags` answers from a phase's position. Phases must be defined in sequence order. */
const PHASES = [
  "loading",
  "waiting-for-input",
  "macintosh-reveal",
  "display-on",
  "logo",
  "glass-fade",
  "desktop-reveal",
  "complete",
] as const;

type Phase = (typeof PHASES)[number];

/* The motion the stylesheet animates over. */
const MOTION_MS = {
  loadingCoverFade: 600,
  crtWarmUp: 500,
  logoDraw: 250,
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
};

const MINIMUM_LOADING_MS = 1000; // The shortest time the loading spinner is shown for (to avoid a flash on warm loads).

const SCREEN_FILTER_ID = "boot-screen";
const SCREEN_STYLE: StyleWithVars = { "--filter-url": `url(#${SCREEN_FILTER_ID})` };

interface Metrics {
  display: Rect; // The cutout in the illustration, in viewport coordinates.
  view: Size;
  pixelRatio: number;
}

function phaseFlags(phase: Phase) {
  const step = PHASES.indexOf(phase);
  const from = (first: Phase) => step >= PHASES.indexOf(first);
  const before = (first: Phase) => step < PHASES.indexOf(first);

  return {
    isLoadingCoverUp: before("macintosh-reveal"),
    isWarmingUp: phase === "display-on",
    isDisplayOn: from("display-on"),
    isScreenTreated: from("display-on") && before("desktop-reveal"),
    isScreenContentVisible: from("logo") && before("desktop-reveal"),
    isPreparingToLeave: from("logo"), // Used to apply `will-change` hints to the layers that will be animated out.
    isGlassHidden: from("glass-fade"),
    isRevealingDesktop: phase === "desktop-reveal",
  };
}

const sequence = (motion: Motion) =>
  [
    { phase: "macintosh-reveal", durationMs: motion.loadingCoverFade + HOLD_MS.illustrationReveal },
    { phase: "display-on", durationMs: motion.crtWarmUp + HOLD_MS.displayOn },
    { phase: "logo", durationMs: motion.logoDraw + HOLD_MS.logo },
    { phase: "glass-fade", durationMs: motion.glassFade },
    { phase: "desktop-reveal", durationMs: motion.desktopReveal },
  ] as const satisfies ReadonlyArray<{ phase: Phase; durationMs: number }>;

const cssInset = (edges: Inset) => `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px`;

const isBeginKey = (event: KeyboardEvent) =>
  !event.altKey && !event.ctrlKey && !event.metaKey && !NON_GESTURE_KEYS.has(event.key);
const isTouchOnly = () => (window as Partial<Window>).matchMedia?.("(any-hover: none)").matches ?? false;

async function whenFontsReady(): Promise<void> {
  const fontSet = (document as Partial<Document>).fonts;

  if (!fontSet) {
    return;
  }

  const consoleFont = getComputedStyle(document.documentElement).getPropertyValue("--font-console").trim();

  try {
    if (consoleFont) {
      await fontSet.load(consoleFont);
    }

    await fontSet.ready;
  } catch {
    // Ignored.
  }
}

function whenIllustrationReady(image: HTMLImageElement | null): Promise<unknown> {
  return image?.decode ? image.decode().catch(() => undefined) : Promise.resolve();
}

function ScreenFilter({ bloom }: { bloom: Bloom }) {
  return (
    <svg className={styles.filterDefinition} aria-hidden>
      <filter id={SCREEN_FILTER_ID} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="luminance" />
        <feComponentTransfer in="luminance" result="highlights">
          <feFuncA type="table" tableValues={bloom.highlights} />
        </feComponentTransfer>
        <feGaussianBlur in="highlights" stdDeviation={bloom.coreRadius} result="core" />
        <feComponentTransfer in="highlights" result="haloIntensity">
          <feFuncA type="linear" slope={bloom.haloIntensity} />
        </feComponentTransfer>
        <feGaussianBlur in="haloIntensity" stdDeviation={bloom.haloRadius} result="halo" />
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
          <div className={clsx(styles.screen, isGlassHidden && styles.leaving)} style={SCREEN_STYLE}>
            <LogoIcon className={styles.logo} />
          </div>
        )}
        {isScreenTreated && <div className={clsx(styles.crtOverlay, isGlassHidden && styles.leaving)} />}
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

const noSubscribe = () => () => {};
const serverShouldBoot = () => false;

export function BootSequence() {
  return useSyncExternalStore(noSubscribe, shouldBoot, serverShouldBoot) ? <Sequence /> : null;
}
