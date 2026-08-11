import { NON_GESTURE_KEYS } from "../audio/context";

/* Note: `phaseFlags` answers from a phase's position. Phases must be defined in sequence order. */
const PHASES = [
  "loading",
  "waiting-for-input",
  "macintosh-reveal",
  "stage-zoom",
  "display-on",
  "logo",
  "glass-fade",
  "desktop-reveal",
  "complete",
] as const;

export type Phase = (typeof PHASES)[number];

/* The motion the stylesheet animates over. */
export const MOTION_MS = {
  loadingCoverFade: 600,
  stageZoom: 800,
  crtWarmUp: 500,
  logoDraw: 250,
  glassFade: 150,
  desktopReveal: 350, // Matches `--duration-desktop-reveal-step` in `styles.css`.
};

export type Motion = typeof MOTION_MS;

/* Substituted under a reduced motion preference. */
export const REDUCED_MOTION_MS: Motion = {
  ...MOTION_MS,
  stageZoom: 0,
  crtWarmUp: 0,
  desktopReveal: 0,
};

export const HOLD_MS = {
  illustrationReveal: 400,
  stageZoom: 150,
  displayOn: 500,
  logo: 1400,
};

export const MINIMUM_LOADING_MS = 1000; // The shortest time the loading spinner is shown for (to avoid a flash on warm loads).

export function phaseFlags(phase: Phase) {
  const step = PHASES.indexOf(phase);
  const from = (first: Phase) => step >= PHASES.indexOf(first);
  const before = (first: Phase) => step < PHASES.indexOf(first);

  return {
    isLoadingCoverUp: before("macintosh-reveal"),
    isZoomedOut: before("stage-zoom"),
    isPreparingToZoom: before("display-on"), // Used to apply `will-change` hints.
    isWarmingUp: phase === "display-on",
    isDisplayOn: from("display-on"),
    isScreenContentVisible: from("logo") && before("desktop-reveal"),
    isPreparingToLeave: from("logo"), // Used to apply `will-change` hints.
    isGlassHidden: from("glass-fade"),
    isRevealingDesktop: phase === "desktop-reveal",
  };
}

export const hasStageZoom = (motion: Motion) => motion.stageZoom > 0;

export interface Step {
  phase: Phase;
  durationMs: number;
}

export const sequence = (motion: Motion) =>
  [
    { phase: "macintosh-reveal", durationMs: motion.loadingCoverFade + HOLD_MS.illustrationReveal },
    { phase: "stage-zoom", durationMs: motion.stageZoom + HOLD_MS.stageZoom },
    { phase: "display-on", durationMs: motion.crtWarmUp + HOLD_MS.displayOn },
    { phase: "logo", durationMs: motion.logoDraw + HOLD_MS.logo },
    { phase: "glass-fade", durationMs: motion.glassFade },
    { phase: "desktop-reveal", durationMs: motion.desktopReveal },
  ] as const satisfies ReadonlyArray<Step>;

export function startOfPhaseMs(steps: ReadonlyArray<Step>, phase: Phase): number {
  let elapsedMs = 0;

  for (const step of steps) {
    if (step.phase === phase) {
      break;
    }

    elapsedMs += step.durationMs;
  }

  return elapsedMs;
}

export const isBeginKey = (event: KeyboardEvent) =>
  !event.altKey && !event.ctrlKey && !event.metaKey && !NON_GESTURE_KEYS.has(event.key);

export const isTouchOnly = () => (window as Partial<Window>).matchMedia?.("(any-hover: none)").matches ?? false;

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

export function whenIllustrationReady(image: HTMLImageElement | null): Promise<unknown> {
  return image?.decode ? image.decode().catch(() => undefined) : Promise.resolve();
}
