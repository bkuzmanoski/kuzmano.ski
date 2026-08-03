import clsx from "clsx";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import LogoIcon from "#/assets/images/logo.svg?react";
import DiskActivityIndicator from "#/assets/images/macintosh-disk-activity-indicator.svg?react";
import Display from "#/assets/images/macintosh-display.svg?react";
import macintoshImageUrl from "#/assets/images/macintosh.png";
import { HAS_BOOTED_STORAGE_KEY, setHasBooted, setIsBootSequenceComplete, shouldBoot } from "#/lib/boot";
import type { Rect, Size } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";

import styles from "./boot-overlay.module.css";

import type { CSSProperties } from "react";

const BOOT_OVERLAY_ATTRIBUTE = "data-boot";
const MIN_LOADING_MS = 1000; // Minimum time to show the loading cover before revealing the boot sequence
const ASSET_TIMEOUT_MS = 5000; // Time to wait for the illustration and the font to load before giving up.

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

const DISPLAY_ON_MS = 500;
const LOGO_MS = 2000;
const WELCOME_DIALOG_MS = 2000;
const REVEAL_DESKTOP_MS = 500;

type Phase = "pending" | "display-on" | "logo" | "welcome-dialog" | "desktop-reveal" | "complete";

/** Resolves when required assets are loaded, or if the wait has been too long. */
async function whenReady(image: HTMLImageElement | null): Promise<unknown> {
  const minDelay = new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS));
  const fontSet = (document as Partial<Document>).fonts?.ready ?? Promise.resolve();
  const illustrationImage = image?.decode ? image.decode().catch(() => undefined) : Promise.resolve();

  let timer: ReturnType<typeof setTimeout> | undefined;

  const promises = Promise.all([minDelay, fontSet, illustrationImage]);
  const timeout = new Promise((resolve) => (timer = setTimeout(resolve, ASSET_TIMEOUT_MS)));

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
 * Insets for a child of `box` that places its edges on the edges of the
 * viewport, negative on every side. Each edge is given its own distance to
 * travel, so animating to them reaches all four corners at once rather than
 * the nearest one first.
 *
 * These are applied to the element rather than through a custom property
 * because the build expands an `inset` shorthand into its four longhands.
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

function BootSequence() {
  const [phase, setPhase] = useState<Phase>("pending");
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

      setPhase("display-on");

      const at = (delay: number, next: Phase) => timers.push(setTimeout(() => setPhase(next), delay));

      at(DISPLAY_ON_MS, "logo");
      at(DISPLAY_ON_MS + LOGO_MS, "welcome-dialog");
      at(DISPLAY_ON_MS + LOGO_MS + WELCOME_DIALOG_MS, "desktop-reveal");

      timers.push(
        setTimeout(
          () => {
            setPhase("complete");
            setIsBootSequenceComplete();
          },
          DISPLAY_ON_MS + LOGO_MS + WELCOME_DIALOG_MS + REVEAL_DESKTOP_MS,
        ),
      );
    });

    return () => {
      isCancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "complete") {
    return null;
  }

  const displayStyle: CSSProperties & Record<`--${string}`, string | number> = geometry
    ? {
        left: geometry.display.x,
        top: geometry.display.y,
        width: geometry.display.width,
        height: geometry.display.height,
        "--display-scale": geometry.display.width / VIEWABLE_AREA.width,
      }
    : {};

  const isDisplayOn = phase === "logo" || phase === "welcome-dialog" || phase === "desktop-reveal";
  const isRevealingDesktop = phase === "desktop-reveal";

  return (
    <div className={styles.overlay} aria-hidden>
      <div className={styles.backdrop}>
        <div className={styles.spotlight} />
      </div>
      {geometry && (
        <div className={clsx(styles.displayMask, isRevealingDesktop && styles.revealing)} style={displayStyle}>
          <Display className={styles.display} />
          <div
            className={clsx(styles.viewableArea, !isDisplayOn && styles.hidden, isRevealingDesktop && styles.growing)}
            style={isRevealingDesktop ? insetToViewport(geometry.display, geometry.view) : undefined}
          >
            {phase === "logo" && <LogoIcon className={styles.logo} />}
            {phase === "welcome-dialog" && <p className={styles.welcomeDialog}>Welcome to kuzmano.ski</p>}
          </div>
        </div>
      )}
      <div className={styles.stage}>
        <div className={clsx(styles.illustration, isRevealingDesktop && styles.blurring)}>
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
      <div className={clsx(styles.cover, phase !== "pending" && styles.leaving)}>
        Loading&nbsp;<span className={styles.block}>&#9608;</span>
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

  window.location.replace("/"); // Reloads the page, even if the path is already "/".
}

const noSubscribe = () => () => {};
const serverShouldBoot = () => false;

/**
 * The decision is client-only, so the server and the hydration pass both render
 * nothing; React re-renders with the real answer once hydration is done. The
 * `data-boot` cover painted by the inline script holds the black screen across
 * that gap, so there is nothing to see in between.
 */
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
      }, 4000);
    }
  } catch (e) {
    // Ignored.
  }
})();`;
