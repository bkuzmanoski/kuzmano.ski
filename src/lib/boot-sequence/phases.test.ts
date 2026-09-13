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

  test("sets `isZoomedOut` until the `stage-zoom` phase", () => {
    expect(phaseFlags("loading").isZoomedOut).toBe(true);
    expect(phaseFlags("macintosh-reveal").isZoomedOut).toBe(true);
    expect(phaseFlags("stage-zoom").isZoomedOut).toBe(false);
    expect(phaseFlags("complete").isZoomedOut).toBe(false);
  });

  test("sets `isPreparingToZoom` until the `display-on` phase", () => {
    expect(phaseFlags("macintosh-reveal").isPreparingToZoom).toBe(true);
    expect(phaseFlags("stage-zoom").isPreparingToZoom).toBe(true);
    expect(phaseFlags("display-on").isPreparingToZoom).toBe(false);
  });

  test("sets `isWarmingUp` only for the `display-on` phase and `isDisplayOn` from that phase onwards", () => {
    expect(phaseFlags("macintosh-reveal").isDisplayOn).toBe(false);
    expect(phaseFlags("stage-zoom").isDisplayOn).toBe(false);
    expect(phaseFlags("display-on")).toMatchObject({ isWarmingUp: true, isDisplayOn: true });
    expect(phaseFlags("logo")).toMatchObject({ isWarmingUp: false, isDisplayOn: true });
    expect(phaseFlags("complete").isDisplayOn).toBe(true);
  });

  test("sets `isScreenContentVisible` from the `logo` phase until the `desktop-reveal` phase", () => {
    expect(phaseFlags("display-on").isScreenContentVisible).toBe(false);
    expect(phaseFlags("logo").isScreenContentVisible).toBe(true);
    expect(phaseFlags("glass-fade").isScreenContentVisible).toBe(true);
    expect(phaseFlags("desktop-reveal").isScreenContentVisible).toBe(false);
  });

  test("sets `isGlassHidden` from the `glass-fade` phase and `isRevealingDesktop` only for the `desktop-reveal` phase", () => {
    expect(phaseFlags("logo").isGlassHidden).toBe(false);
    expect(phaseFlags("glass-fade").isGlassHidden).toBe(true);
    expect(phaseFlags("desktop-reveal").isRevealingDesktop).toBe(true);
    expect(phaseFlags("complete").isRevealingDesktop).toBe(false);
  });
});

describe("hasStageZoom", () => {
  test("is `true` when the stage zoom has a motion duration", () => {
    expect(hasStageZoom(MOTION_DURATION_MS)).toBe(true);
  });

  test("is `false` when the stage zoom has a motion duration of 0 under reduced motion", () => {
    expect(hasStageZoom(REDUCED_MOTION_DURATION_MS)).toBe(false);
  });
});

describe("sequence", () => {
  test("returns the phases in order, ending before `complete`", () => {
    expect(sequence(MOTION_DURATION_MS).map(({ phase }) => phase)).toEqual([
      "macintosh-reveal",
      "stage-zoom",
      "display-on",
      "logo",
      "glass-fade",
      "desktop-reveal",
    ]);
  });

  test("gives each step its motion duration plus its hold duration", () => {
    const steps = sequence(MOTION_DURATION_MS);

    expect(steps[0].durationMs).toBe(MOTION_DURATION_MS.loadingCoverFade + HOLD_DURATION_MS.illustrationReveal);
    expect(steps[1].durationMs).toBe(MOTION_DURATION_MS.stageZoom + HOLD_DURATION_MS.stageZoom);
    expect(steps[3].durationMs).toBe(MOTION_DURATION_MS.logoDraw + HOLD_DURATION_MS.logo);
  });

  test("gives the zoom, warm-up, and desktop reveal steps only their hold durations under reduced motion", () => {
    const steps = sequence(REDUCED_MOTION_DURATION_MS);

    expect(steps[1].durationMs).toBe(HOLD_DURATION_MS.stageZoom);
    expect(steps[2].durationMs).toBe(HOLD_DURATION_MS.displayOn);
    expect(steps[5].durationMs).toBe(0);
  });
});

describe("startOfPhaseMs", () => {
  const steps = sequence(MOTION_DURATION_MS);
  const runMs = steps.reduce((total, { durationMs }) => total + durationMs, 0);

  test("returns 0 for the first phase", () => {
    expect(startOfPhaseMs(steps, "macintosh-reveal")).toBe(0);
  });

  test("returns the combined duration of the steps before a later phase", () => {
    expect(startOfPhaseMs(steps, "display-on")).toBe(steps[0].durationMs + steps[1].durationMs);
    expect(startOfPhaseMs(steps, "desktop-reveal")).toBe(runMs - steps[5].durationMs);
  });

  test("returns the combined duration of every step for a phase the sequence does not include", () => {
    expect(startOfPhaseMs(steps, "complete")).toBe(runMs);
  });
});
