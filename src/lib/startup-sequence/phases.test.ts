import { describe, expect, test } from "vitest";

import {
  HOLD_DURATION_MS,
  MOTION_DURATION_MS,
  REDUCED_MOTION_DURATION_MS,
  hasStageZoom,
  phaseFlags,
  sequence,
  startOfPhaseMs,
} from "./phases.ts";

describe("phaseFlags", () => {
  test("sets `isLoadingCoverUp` until the `macintosh-reveal` phase", () => {
    expect(phaseFlags("loading").isLoadingCoverUp).toBe(true);
    expect(phaseFlags("waiting-for-input").isLoadingCoverUp).toBe(true);
    expect(phaseFlags("macintosh-reveal").isLoadingCoverUp).toBe(false);
  });

  test("sets `isRevealingMacintosh` only for the `macintosh-reveal` phase", () => {
    expect(phaseFlags("waiting-for-input").isRevealingMacintosh).toBe(false);
    expect(phaseFlags("macintosh-reveal").isRevealingMacintosh).toBe(true);
    expect(phaseFlags("display-on").isRevealingMacintosh).toBe(false);
  });

  test("sets `isZoomedOut` until the `macintosh-reveal` phase", () => {
    expect(phaseFlags("loading").isZoomedOut).toBe(true);
    expect(phaseFlags("waiting-for-input").isZoomedOut).toBe(true);
    expect(phaseFlags("macintosh-reveal").isZoomedOut).toBe(false);
    expect(phaseFlags("complete").isZoomedOut).toBe(false);
  });

  test("sets `isPreparingToZoom` until the `display-on` phase", () => {
    expect(phaseFlags("waiting-for-input").isPreparingToZoom).toBe(true);
    expect(phaseFlags("macintosh-reveal").isPreparingToZoom).toBe(true);
    expect(phaseFlags("display-on").isPreparingToZoom).toBe(false);
  });

  test("sets `isWarmingUp` only for the `display-on` phase", () => {
    expect(phaseFlags("macintosh-reveal").isWarmingUp).toBe(false);
    expect(phaseFlags("display-on").isWarmingUp).toBe(true);
    expect(phaseFlags("logo").isWarmingUp).toBe(false);
  });

  test("sets `isDisplayOn` from the `display-on` phase", () => {
    expect(phaseFlags("macintosh-reveal").isDisplayOn).toBe(false);
    expect(phaseFlags("display-on").isDisplayOn).toBe(true);
    expect(phaseFlags("logo").isDisplayOn).toBe(true);
    expect(phaseFlags("complete").isDisplayOn).toBe(true);
  });

  test("sets `isScreenContentVisible` from the `logo` phase until the `desktop-reveal` phase", () => {
    expect(phaseFlags("display-on").isScreenContentVisible).toBe(false);
    expect(phaseFlags("logo").isScreenContentVisible).toBe(true);
    expect(phaseFlags("glass-fade").isScreenContentVisible).toBe(true);
    expect(phaseFlags("desktop-reveal").isScreenContentVisible).toBe(false);
  });

  test("sets `isPreparingToLeave` from the `logo` phase", () => {
    expect(phaseFlags("display-on").isPreparingToLeave).toBe(false);
    expect(phaseFlags("logo").isPreparingToLeave).toBe(true);
    expect(phaseFlags("complete").isPreparingToLeave).toBe(true);
  });

  test("sets `isGlassHidden` from the `glass-fade` phase", () => {
    expect(phaseFlags("logo").isGlassHidden).toBe(false);
    expect(phaseFlags("glass-fade").isGlassHidden).toBe(true);
  });

  test("sets `isRevealingDesktop` only for the `desktop-reveal` phase", () => {
    expect(phaseFlags("desktop-reveal").isRevealingDesktop).toBe(true);
    expect(phaseFlags("complete").isRevealingDesktop).toBe(false);
  });
});

describe("hasStageZoom", () => {
  test("returns `true` when the `stageZoom` duration is above `0`", () => {
    expect(hasStageZoom(MOTION_DURATION_MS)).toBe(true);
  });

  test("returns `false` when the `stageZoom` duration is `0`", () => {
    expect(hasStageZoom(REDUCED_MOTION_DURATION_MS)).toBe(false);
  });
});

describe("sequence", () => {
  test("returns a step for each phase from `macintosh-reveal` to `desktop-reveal`, in order", () => {
    expect(sequence(MOTION_DURATION_MS).map(({ phase }) => phase)).toEqual([
      "macintosh-reveal",
      "display-on",
      "logo",
      "glass-fade",
      "desktop-reveal",
    ]);
  });

  test("gives the `macintosh-reveal` step the longer of the `macintoshReveal` and `stageZoom` durations, plus its hold duration", () => {
    expect(sequence({ ...MOTION_DURATION_MS, macintoshReveal: 1000, stageZoom: 500 })[0].durationMs).toBe(
      1000 + HOLD_DURATION_MS.macintoshReveal,
    );
    expect(sequence({ ...MOTION_DURATION_MS, macintoshReveal: 500, stageZoom: 1000 })[0].durationMs).toBe(
      1000 + HOLD_DURATION_MS.macintoshReveal,
    );
  });

  test("gives the `display-on` and `logo` steps their motion durations plus their hold durations", () => {
    const steps = sequence(MOTION_DURATION_MS);

    expect(steps[1].durationMs).toBe(MOTION_DURATION_MS.crtWarmUp + HOLD_DURATION_MS.displayOn);
    expect(steps[2].durationMs).toBe(MOTION_DURATION_MS.logoReveal + HOLD_DURATION_MS.logo);
  });

  test("gives the `display-on` step only its hold duration and the `desktop-reveal` step a duration of `0` with the reduced motion durations", () => {
    const steps = sequence(REDUCED_MOTION_DURATION_MS);

    expect(steps[1].durationMs).toBe(HOLD_DURATION_MS.displayOn);
    expect(steps[4].durationMs).toBe(0);
  });
});

describe("startOfPhaseMs", () => {
  const steps = sequence(MOTION_DURATION_MS);
  const runMs = steps.reduce((total, { durationMs }) => total + durationMs, 0);

  test("returns `0` for the first phase", () => {
    expect(startOfPhaseMs(steps, "macintosh-reveal")).toBe(0);
  });

  test("returns the combined duration of the steps before a later phase", () => {
    expect(startOfPhaseMs(steps, "logo")).toBe(steps[0].durationMs + steps[1].durationMs);
    expect(startOfPhaseMs(steps, "desktop-reveal")).toBe(runMs - steps[4].durationMs);
  });

  test("returns the combined duration of every step for a phase the sequence does not include", () => {
    expect(startOfPhaseMs(steps, "complete")).toBe(runMs);
  });
});
