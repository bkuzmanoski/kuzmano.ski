import { NON_GESTURE_KEYS, needsAudioPriming } from "../audio/context.ts";
import { loadKeySounds } from "../audio/sounds.ts";

/** The phases in sequence order, which `phaseFlags` derives each phase's flags from. */
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

export type Phase = (typeof PHASES)[number];

/** The motion the stylesheet animates over. */
export const MOTION_DURATION_MS = {
  macintoshReveal: 900,
  stageZoom: 1200,
  crtWarmUp: 500,
  logoReveal: 250,
  glassFade: 150,
  desktopReveal: 350, // Set as `--duration-desktop-reveal-step` by `/src/app/desktop.tsx`.
};

export type Motion = typeof MOTION_DURATION_MS;

/** Substituted under a reduced motion preference. */
export const REDUCED_MOTION_DURATION_MS: Motion = {
  ...MOTION_DURATION_MS,
  stageZoom: 0,
  crtWarmUp: 0,
  desktopReveal: 0,
};

export const HOLD_DURATION_MS = {
  macintoshReveal: 150,
  displayOn: 500,
  logo: 1400,
};

/** The shortest time the startup sequence shows the loading indicator for, so it does not flash on a warm load. */
export const MIN_LOADING_DURATION_MS = 1000;

export function phaseFlags(phase: Phase) {
  const phaseIndex = PHASES.indexOf(phase);
  const isAtOrAfter = (first: Phase) => phaseIndex >= PHASES.indexOf(first);
  const isBefore = (first: Phase) => phaseIndex < PHASES.indexOf(first);

  return {
    isLoadingCoverUp: isBefore("macintosh-reveal"),
    isRevealingMacintosh: phase === "macintosh-reveal",
    isZoomedOut: isBefore("macintosh-reveal"),
    isPreparingToZoom: isBefore("display-on"), // Used to apply `will-change` hints.
    isWarmingUp: phase === "display-on",
    isDisplayOn: isAtOrAfter("display-on"),
    isScreenContentVisible: isAtOrAfter("logo") && isBefore("desktop-reveal"),
    isPreparingToLeave: isAtOrAfter("logo"), // Used to apply `will-change` hints.
    isGlassHidden: isAtOrAfter("glass-fade"),
    isRevealingDesktop: phase === "desktop-reveal",
  };
}

export const hasStageZoom = (motionDuration: Motion) => motionDuration.stageZoom > 0;

export interface Step {
  phase: Phase;
  durationMs: number;
}

export const sequence = (motion: Motion) =>
  [
    {
      phase: "macintosh-reveal",
      durationMs: Math.max(motion.macintoshReveal, motion.stageZoom) + HOLD_DURATION_MS.macintoshReveal,
    },
    { phase: "display-on", durationMs: motion.crtWarmUp + HOLD_DURATION_MS.displayOn },
    { phase: "logo", durationMs: motion.logoReveal + HOLD_DURATION_MS.logo },
    { phase: "glass-fade", durationMs: motion.glassFade },
    { phase: "desktop-reveal", durationMs: motion.desktopReveal },
  ] as const satisfies ReadonlyArray<Step>;

export function startOfPhaseMs(steps: ReadonlyArray<Step>, phase: Phase): number {
  let elapsedTimeMs = 0;

  for (const step of steps) {
    if (step.phase === phase) {
      break;
    }

    elapsedTimeMs += step.durationMs;
  }

  return elapsedTimeMs;
}

export const isBeginKey = (event: KeyboardEvent) =>
  !event.altKey && !event.ctrlKey && !event.metaKey && !NON_GESTURE_KEYS.has(event.key);

export async function whenFontReady(): Promise<void> {
  const fontSet = (document as Partial<Document>).fonts;

  if (!fontSet) {
    return;
  }

  const promptFont = getComputedStyle(document.documentElement).getPropertyValue("--font-chrome").trim();

  try {
    if (promptFont) {
      await fontSet.load(promptFont);
    }

    await fontSet.ready;
  } catch {
    // Ignored.
  }
}

/** Keypress sounds play only from the begin prompt, which only appears if audio needs priming. */
export const whenKeySoundsReady = (): Promise<unknown> => (needsAudioPriming() ? loadKeySounds() : Promise.resolve());

export function whenIllustrationReady(...images: Array<HTMLImageElement | null>): Promise<unknown> {
  return Promise.all(
    images.map((image) => (image?.decode ? image.decode().catch(() => undefined) : Promise.resolve())),
  );
}

/**
 * In Firefox, replaces the SVG in the display's glass layer `image` with a PNG rendered at the device pixel size of its
 * layout box, so the stage zoom resamples a bitmap. A failed step leaves the SVG in place.
 *
 * Firefox rasterizes an SVG image on the main thread as the stage's scale changes. These filters take about 300ms at
 * large window sizes, which freezes the zoom, and a rasterization at the end of the zoom can display an earlier
 * transform. Other browsers keep the SVG, as Safari and Chrome weaken the grain that dithers the glass layer when they
 * render it to a canvas.
 */
export async function whenDisplayGlassLayerReady(image: HTMLImageElement | null): Promise<void> {
  if (!image || !CSS.supports("-moz-appearance: none")) {
    return;
  }

  try {
    await image.decode();

    // Reads the computed size because `clientWidth` rounds to a whole CSS pixel, and a browser that resamples the PNG
    // to fit its layout box softens the grain.
    const { width, height } = getComputedStyle(image);
    const canvas = document.createElement("canvas");

    canvas.width = Math.round(parseFloat(width) * window.devicePixelRatio);
    canvas.height = Math.round(parseFloat(height) * window.devicePixelRatio);

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve));

    if (!pngBlob) {
      return;
    }

    const pngUrl = URL.createObjectURL(pngBlob);

    image.src = pngUrl;
    await image.decode().finally(() => URL.revokeObjectURL(pngUrl));
  } catch {
    // Ignored.
  }
}
