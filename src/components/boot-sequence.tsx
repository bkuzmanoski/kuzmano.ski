import clsx from "clsx";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import DiskActivityIndicator from "#/assets/images/macintosh-disk-activity-indicator.svg?react";
import DisplayBackdrop from "#/assets/images/macintosh-display-backdrop.svg?react";
import macintoshImageUrl from "#/assets/images/macintosh.png";
import { SITE_NAME } from "#/config/site";
import { playBootChime, playDiskActivity } from "#/lib/audio/boot";
import { NON_GESTURE_KEYS, unlockAudio } from "#/lib/audio/context";
import {
  HAS_BOOTED_STORAGE_KEY,
  MAX_LOADING_MS,
  clearBootOverlay,
  setHasBooted,
  setIsBootSequenceComplete,
  shouldBoot,
} from "#/lib/boot";
import type { Rect, Size } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";
import { getPrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion";

import styles from "./boot-sequence.module.css";

import type { CSSProperties } from "react";

/* Metrics derived from `macintosh.png` */
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

const SCREEN_INSET = { x: 24, y: 28 };
const SCREEN_RADIUS = 16;
const SCREEN_FILTER_ID = "boot-screen";
const SCREEN_PINCUSHION_BOW_PX = 8;
const SCREEN_RGB_SHIFT_PX = 0.5;

const MIN_LOADING_MS = 1000; // Minimum time to show the loading cover before revealing the boot sequence.

/* The durations the stylesheet animates over. Reduced motion preference overrides these to 0. */
const LOADING_COVER_FADE_MS = 1000;
const WELCOME_DIALOG_DRAW_MS = 250;
const DESKTOP_REVEAL_MS = 500;

type Phase =
  | "loading"
  | "waiting-for-input"
  | "macintosh-reveal"
  | "display-on"
  | "logo"
  | "welcome-dialog"
  | "desktop-reveal"
  | "complete";

const sequence = (loadingCoverFadeMs: number, desktopRevealMs: number) =>
  [
    { phase: "macintosh-reveal", durationMs: loadingCoverFadeMs },
    { phase: "display-on", durationMs: 1000 },
    { phase: "logo", durationMs: 2000 },
    { phase: "welcome-dialog", durationMs: 2000 },
    { phase: "desktop-reveal", durationMs: desktopRevealMs },
  ] as const satisfies ReadonlyArray<{ phase: Phase; durationMs: number }>;

/* The phases each layer is up for, so a component reads its state once per render. */
const LOADING_COVER_PHASES = new Set<Phase>(["loading", "waiting-for-input"]);
const DISPLAY_ON_PHASES = new Set<Phase>(["display-on", "logo", "welcome-dialog", "desktop-reveal"]);

const isBeginKey = (event: KeyboardEvent) =>
  !event.altKey && !event.ctrlKey && !event.metaKey && !NON_GESTURE_KEYS.has(event.key);
const isTouchOnly = () => (window as Partial<Window>).matchMedia?.("(any-hover: none)").matches ?? false;

/** Resolves when required assets are loaded, or if the wait has been too long. */
async function whenReady(image: HTMLImageElement | null): Promise<unknown> {
  const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS));
  const illustrationImage = image?.decode ? image.decode().catch(() => undefined) : Promise.resolve();
  const fontSet = (document as Partial<Document>).fonts?.ready ?? Promise.resolve();

  let timer: ReturnType<typeof setTimeout> | undefined;

  const promises = Promise.all([minDelay, illustrationImage, fontSet]);
  const timeout = new Promise((resolve) => (timer = setTimeout(resolve, MAX_LOADING_MS)));

  try {
    return await Promise.race([promises, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Exported for unit tests. */
export function viewableAreaOf(box: { left: number; top: number; width: number; height: number }): Rect {
  return {
    x: box.left + box.width * VIEWABLE_AREA_FRACTION.x,
    y: box.top + box.height * VIEWABLE_AREA_FRACTION.y,
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
export function insetToViewport(box: Rect, view: Size) {
  return {
    top: -box.y,
    right: box.x + box.width - view.width,
    bottom: box.y + box.height - view.height,
    left: -box.x,
  };
}

const cssInset = (edges: ReturnType<typeof insetToViewport>) =>
  `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px`;

const round = (value: number) => Math.round(value * 100) / 100;

function screenClipPath(width: number, height: number, radius: number, bow: number) {
  const w = round(width);
  const h = round(height);
  const r = round(radius);
  const c = round(bow);
  const midX = round(width / 2);
  const midY = round(height / 2);

  return `path("${[
    `M${c + r} ${c}`,
    `Q${midX} 0 ${w - c - r} ${c}`,
    `Q${w - c} ${c} ${w - c} ${c + r}`,
    `Q${w} ${midY} ${w - c} ${h - c - r}`,
    `Q${w - c} ${h - c} ${w - c - r} ${h - c}`,
    `Q${midX} ${h} ${c + r} ${h - c}`,
    `Q${c} ${h - c} ${c} ${h - c - r}`,
    `Q0 ${midY} ${c} ${c + r}`,
    `Q${c} ${c} ${c + r} ${c}`,
    "Z",
  ].join("")}")`;
}

function ScreenFilter({ scale }: { scale: number }) {
  const shiftAmount = SCREEN_RGB_SHIFT_PX * scale;

  return (
    <svg className={styles.filterDefinitions} aria-hidden>
      <filter id={SCREEN_FILTER_ID} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
          result="red"
        />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
          result="green"
        />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
          result="blue"
        />
        <feOffset in="red" dx={-shiftAmount} result="redShifted" />
        <feOffset in="blue" dx={shiftAmount} result="blueShifted" />
        <feBlend in="redShifted" in2="green" mode="screen" result="redGreen" />
        <feBlend in="redGreen" in2="blueShifted" mode="screen" />
      </filter>
    </svg>
  );
}

function Display({ geometry, view, phase }: { geometry: Rect; view: Size; phase: Phase }) {
  const scale = geometry.width / VIEWABLE_AREA.width;
  const isLoadingCoverUp = LOADING_COVER_PHASES.has(phase);
  const isDisplayOn = DISPLAY_ON_PHASES.has(phase);
  const isRevealingDesktop = phase === "desktop-reveal";
  const displayMaskStyle: CSSProperties & Record<`--${string}`, string | number> = {
    left: geometry.x,
    top: geometry.y,
    width: geometry.width,
    height: geometry.height,
    "--display-scale": scale,
  };
  const viewableAreaStyle: CSSProperties & Record<`--${string}`, string | number> = isRevealingDesktop
    ? { "--inset": cssInset(insetToViewport(geometry, view)), clipPath: "none" }
    : {
        "--inset": `${SCREEN_INSET.y * scale}px ${SCREEN_INSET.x * scale}px`,
        clipPath: screenClipPath(
          geometry.width - 2 * SCREEN_INSET.x * scale,
          geometry.height - 2 * SCREEN_INSET.y * scale,
          SCREEN_RADIUS * scale,
          SCREEN_PINCUSHION_BOW_PX * scale,
        ),
      };

  return (
    <div
      className={clsx(styles.displayMask, isLoadingCoverUp && styles.hidden, isRevealingDesktop && styles.revealing)}
      style={displayMaskStyle}
    >
      <ScreenFilter scale={scale} />
      <DisplayBackdrop className={styles.display} />
      <div
        className={clsx(styles.viewableArea, !isDisplayOn && styles.hidden, isRevealingDesktop && styles.growing)}
        style={viewableAreaStyle}
      >
        {(phase === "logo" || phase === "welcome-dialog") && (
          <div className={styles.screen}>
            {phase === "logo" && <LogoIcon className={styles.logo} />}
            {phase === "welcome-dialog" && <p className={styles.welcomeDialog}>Welcome to {SITE_NAME}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Sequence() {
  const [prefersReducedMotion] = useState(getPrefersReducedMotion); // Held for the whole run, so the durations the stylesheet animates over and the timers the phases run do not disagree if the preference changes.
  const [phase, setPhase] = useState<Phase>("loading");
  const [geometry, setGeometry] = useState<{ display: Rect; view: Size } | null>(null);
  const illustrationImageRef = useRef<HTMLImageElement>(null);
  const illustrationImageSize = useElementSize(illustrationImageRef);

  useEffect(() => {
    const element = illustrationImageRef.current;

    if (!element || illustrationImageSize.width === 0) {
      return;
    }

    setGeometry({
      display: viewableAreaOf(element.getBoundingClientRect()),
      view: { width: window.innerWidth, height: window.innerHeight },
    });
  }, [illustrationImageSize]);

  const startSequence = useEffectEvent(() => {
    const phases = sequence(
      prefersReducedMotion ? 0 : LOADING_COVER_FADE_MS,
      prefersReducedMotion ? 0 : DESKTOP_REVEAL_MS,
    );

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
      document.addEventListener("pointerdown", runSequence, eventListenerOptions);
    });

    function onKeyDown(event: KeyboardEvent) {
      if (isBeginKey(event)) {
        runSequence();
      }
    }

    function runSequence() {
      unlockAudio();
      waitingForInput.abort(); // Drops both listeners: only the first press counts.
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

  const isLoadingCoverUp = LOADING_COVER_PHASES.has(phase);
  const isDisplayOn = DISPLAY_ON_PHASES.has(phase);
  const isRevealingDesktop = phase === "desktop-reveal";
  const containerStyle: CSSProperties & Record<`--${string}`, string | number> = {
    "--loading-cover-fade-ms": `${prefersReducedMotion ? 0 : LOADING_COVER_FADE_MS}ms`,
    "--welcome-dialog-draw-ms": `${prefersReducedMotion ? 0 : WELCOME_DIALOG_DRAW_MS}ms`,
    "--desktop-reveal-ms": `${prefersReducedMotion ? 0 : DESKTOP_REVEAL_MS}ms`,
  };
  const beginPrompt = isTouchOnly() ? "Tap to begin" : "Press any key to begin";

  return (
    <div className={styles.container} style={containerStyle}>
      {geometry && <Display geometry={geometry.display} view={geometry.view} phase={phase} />}
      <div className={styles.stage}>
        <div
          className={clsx(
            styles.illustration,
            isLoadingCoverUp && styles.hidden,
            isRevealingDesktop && styles.blurring,
          )}
        >
          <div className={styles.spotlight} />
          <DiskActivityIndicator
            className={clsx(styles.diskActivityIndicator, isDisplayOn && styles.reading)}
            style={{
              left: `${DISK_LIGHT_FRACTION.x * 100}%`,
              top: `${DISK_LIGHT_FRACTION.y * 100}%`,
              width: `${DISK_LIGHT_FRACTION.size * 100}%`,
            }}
          />
          <img ref={illustrationImageRef} alt="Illustration of a classic Mac 128K." src={macintoshImageUrl} />
        </div>
      </div>
      <div className={clsx(styles.loadingCover, !isLoadingCoverUp && styles.leaving)} />
      <div className={clsx(styles.loadingMessageWrapper, !isLoadingCoverUp && styles.leaving)}>
        <div className={styles.loadingMessage}>
          {/* TODO: Implement typewriter effect. */}
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

/** Clears saved settings and reloads the desktop. */
export function restart() {
  try {
    localStorage.clear();
    sessionStorage.removeItem(HAS_BOOTED_STORAGE_KEY);
  } catch {
    // Ignored.
  }

  window.location.replace("/");
}
