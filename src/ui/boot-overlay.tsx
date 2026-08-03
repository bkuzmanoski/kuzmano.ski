import clsx from "clsx";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import DiskActivityIndicator from "#/assets/images/macintosh-disk-activity-indicator.svg?react";
import DisplayBackdrop from "#/assets/images/macintosh-display-backdrop.svg?react";
import macintoshImageUrl from "#/assets/images/macintosh.png";
import { SITE_NAME } from "#/config/site";
import { HAS_BOOTED_STORAGE_KEY, setHasBooted, setIsBootSequenceComplete, shouldBoot } from "#/lib/boot";
import type { Rect, Size } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";
import { getPrefersReducedMotion, usePrefersReducedMotion } from "#/lib/hooks/use-prefers-reduced-motion";

import styles from "./boot-overlay.module.css";

import type { CSSProperties } from "react";

const BOOT_OVERLAY_ATTRIBUTE = "data-boot";

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

const SCREEN_INSET = { x: 28, y: 32 };
const SCREEN_RADIUS = 16;
const SCREEN_FILTER_ID = "boot-screen";
const SCREEN_PINCUSHION_BOW_PX = 8;
const SCREEN_RGB_SHIFT_PX = 0.5;

/* Timings. */
const MIN_LOADING_MS = 1000; // Minimum time to show the loading cover before revealing the boot sequence.
const MAX_LOADING_MS = 5000; // Time to wait for the illustration and the font to load revealing the boot sequence.

/* The two durations the stylesheet animates over. Both are motion
 * rather than dwell, so reduced motion takes them to nothing. */
const LOADING_COVER_FADE_MS = 1000;
const DESKTOP_REVEAL_MS = 500;

type Phase = "loading" | "display-on" | "logo" | "welcome-dialog" | "desktop-reveal" | "complete";

const PHASE_SEQUENCE = [
  { phase: "display-on", durationMs: 500 },
  { phase: "logo", durationMs: 2000 },
  { phase: "welcome-dialog", durationMs: 2000 },
  { phase: "desktop-reveal", durationMs: DESKTOP_REVEAL_MS },
] as const satisfies ReadonlyArray<{ phase: Phase; durationMs: number }>;

const isDisplayOn = (phase: Phase) => phase === "logo" || phase === "welcome-dialog" || phase === "desktop-reveal";

/** Resolves when required assets are loaded, or if the wait has been too long. */
async function whenReady(image: HTMLImageElement | null): Promise<unknown> {
  const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS));
  const fontSet = (document as Partial<Document>).fonts?.ready ?? Promise.resolve();
  const illustrationImage = image?.decode ? image.decode().catch(() => undefined) : Promise.resolve();

  let timer: ReturnType<typeof setTimeout> | undefined;

  const promises = Promise.all([minDelay, fontSet, illustrationImage]);
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
 * These are applied to the element rather than through a custom property
 * because the build expands the `inset` shorthand into its four longhands.
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
  const isRevealingDesktop = phase === "desktop-reveal";
  const displayMaskStyle: CSSProperties & Record<`--${string}`, string | number> = {
    left: geometry.x,
    top: geometry.y,
    width: geometry.width,
    height: geometry.height,
    "--display-scale": scale,
  };
  const viewableAreaStyle: CSSProperties & Record<`--${string}`, string | number> = {
    "--inset-x": `${SCREEN_INSET.x * scale}px`,
    "--inset-y": `${SCREEN_INSET.y * scale}px`,
    ...(isRevealingDesktop
      ? { ...insetToViewport(geometry, view), clipPath: "none" }
      : {
          clipPath: screenClipPath(
            geometry.width - 2 * SCREEN_INSET.x * scale,
            geometry.height - 2 * SCREEN_INSET.y * scale,
            SCREEN_RADIUS * scale,
            SCREEN_PINCUSHION_BOW_PX * scale,
          ),
        }),
  };

  return (
    <div className={clsx(styles.displayMask, isRevealingDesktop && styles.revealing)} style={displayMaskStyle}>
      <ScreenFilter scale={scale} />
      <DisplayBackdrop className={styles.display} />
      <div
        className={clsx(
          styles.viewableArea,
          !isDisplayOn(phase) && styles.hidden,
          isRevealingDesktop && styles.growing,
        )}
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

function BootSequence() {
  const prefersReducedMotion = usePrefersReducedMotion();
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

  useEffect(() => {
    setHasBooted();
    document.documentElement.removeAttribute(BOOT_OVERLAY_ATTRIBUTE);

    let isCancelled = false;

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    void whenReady(illustrationImageRef.current).then(() => {
      if (isCancelled) {
        return;
      }

      setPhase(PHASE_SEQUENCE[0].phase);

      let elapsedMs = getPrefersReducedMotion() ? 0 : LOADING_COVER_FADE_MS;

      PHASE_SEQUENCE.forEach(({ durationMs }, index) => {
        const nextPhase: Phase = PHASE_SEQUENCE[index + 1]?.phase ?? "complete";

        elapsedMs += durationMs;

        timers.push(
          setTimeout(() => {
            setPhase(nextPhase);

            if (nextPhase === "complete") {
              setIsBootSequenceComplete();
            }
          }, elapsedMs),
        );
      });
    });

    return () => {
      isCancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "complete") {
    return null;
  }

  const isRevealingDesktop = phase === "desktop-reveal";
  const overlayStyle: CSSProperties & Record<`--${string}`, string | number> = {
    "--loading-cover-fade-ms": `${prefersReducedMotion ? 0 : LOADING_COVER_FADE_MS}ms`,
    "--desktop-reveal-ms": `${prefersReducedMotion ? 0 : DESKTOP_REVEAL_MS}ms`,
  };

  return (
    <div className={styles.overlay} style={overlayStyle} aria-hidden>
      <div className={styles.backdrop}>
        <div className={styles.spotlight} />
      </div>
      {geometry && <Display geometry={geometry.display} view={geometry.view} phase={phase} />}
      <div className={styles.stage}>
        <div className={clsx(styles.illustration, isRevealingDesktop && styles.blurring)}>
          <DiskActivityIndicator
            className={clsx(styles.diskActivityIndicator, isDisplayOn(phase) && styles.reading)}
            style={{
              left: `${DISK_LIGHT_FRACTION.x * 100}%`,
              top: `${DISK_LIGHT_FRACTION.y * 100}%`,
              width: `${DISK_LIGHT_FRACTION.size * 100}%`,
            }}
          />
          <img ref={illustrationImageRef} alt="Illustration of a classic Mac 128K." src={macintoshImageUrl} />
        </div>
      </div>
      <div className={clsx(styles.cover, phase !== "loading" && styles.leaving)}>
        <div className={styles.loadingMessage}>
          Loading&nbsp;<span className={styles.block}>&#9608;</span>
        </div>
      </div>
    </div>
  );
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

const noSubscribe = () => () => {};
const serverShouldBoot = () => false;

export function BootOverlay() {
  return useSyncExternalStore(noSubscribe, shouldBoot, serverShouldBoot) ? <BootSequence /> : null;
}

/**
 * Runs in the document head before first paint (prior to hydration) to
 * hide the server-rendered desktop until the boot sequence has run.
 */
export const bootOverlayScript = `(function () {
  try {
    if (location.pathname === "/" && !sessionStorage.getItem("${HAS_BOOTED_STORAGE_KEY}")) {
      document.documentElement.setAttribute("${BOOT_OVERLAY_ATTRIBUTE}", "");
      setTimeout(function () {
        document.documentElement.removeAttribute("${BOOT_OVERLAY_ATTRIBUTE}");
      }, ${MAX_LOADING_MS});
    }
  } catch (e) {
    // Ignored.
  }
})();`;
