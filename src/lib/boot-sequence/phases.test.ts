import { describe, expect, test } from "vitest";

import {
  HOLD_DURATION_MS,
  MOTION_DURATION_MS,
  REDUCED_MOTION_DURATION_MS,
  hasStageZoom,
  phaseFlags,
  sequence,
  startOfPhaseMs,
} from "./phases";

describe("phaseFlags", () => {
  test("the loading cover stays up until the illustration is revealed", () => {
    expect(phaseFlags("loading").isLoadingCoverUp).toBe(true);
    expect(phaseFlags("waiting-for-input").isLoadingCoverUp).toBe(true);
    expect(phaseFlags("macintosh-reveal").isLoadingCoverUp).toBe(false);
  });

  test("the stage opens zoomed out and stays in once it has zoomed", () => {
    expect(phaseFlags("loading").isZoomedOut).toBe(true);
    expect(phaseFlags("macintosh-reveal").isZoomedOut).toBe(true);
    expect(phaseFlags("stage-zoom").isZoomedOut).toBe(false);
    expect(phaseFlags("complete").isZoomedOut).toBe(false);
  });

  test("the zoom hint is held from the start until the zoom is over", () => {
    expect(phaseFlags("macintosh-reveal").isPreparingToZoom).toBe(true);
    expect(phaseFlags("stage-zoom").isPreparingToZoom).toBe(true);
    expect(phaseFlags("display-on").isPreparingToZoom).toBe(false);
  });

  test("the display warms up for exactly one phase and then stays on", () => {
    expect(phaseFlags("macintosh-reveal").isDisplayOn).toBe(false);
    expect(phaseFlags("stage-zoom").isDisplayOn).toBe(false);
    expect(phaseFlags("display-on")).toMatchObject({ isWarmingUp: true, isDisplayOn: true });
    expect(phaseFlags("logo")).toMatchObject({ isWarmingUp: false, isDisplayOn: true });
    expect(phaseFlags("complete").isDisplayOn).toBe(true);
  });

  test("the screen content shows from the logo until the desktop reveal", () => {
    expect(phaseFlags("display-on").isScreenContentVisible).toBe(false);
    expect(phaseFlags("logo").isScreenContentVisible).toBe(true);
    expect(phaseFlags("glass-fade").isScreenContentVisible).toBe(true);
    expect(phaseFlags("desktop-reveal").isScreenContentVisible).toBe(false);
  });

  test("the glass leaves at its fade and the desktop reveal is its own phase", () => {
    expect(phaseFlags("logo").isGlassHidden).toBe(false);
    expect(phaseFlags("glass-fade").isGlassHidden).toBe(true);
    expect(phaseFlags("desktop-reveal").isRevealingDesktop).toBe(true);
    expect(phaseFlags("complete").isRevealingDesktop).toBe(false);
  });
});

describe("hasStageZoom", () => {
  test("returns true when stage zoom phase has a duration", () => {
    expect(hasStageZoom(MOTION_DURATION_MS)).toBe(true);
  });

  test("returns false when reduced motion disables stage zoom phase", () => {
    expect(hasStageZoom(REDUCED_MOTION_DURATION_MS)).toBe(false);
  });
});

describe("sequence", () => {
  test("steps through the phases in order, ending before complete", () => {
    expect(sequence(MOTION_DURATION_MS).map(({ phase }) => phase)).toEqual([
      "macintosh-reveal",
      "stage-zoom",
      "display-on",
      "logo",
      "glass-fade",
      "desktop-reveal",
    ]);
  });

  test("each step holds for its motion duration plus its hold duration", () => {
    const steps = sequence(MOTION_DURATION_MS);

    expect(steps[0].durationMs).toBe(MOTION_DURATION_MS.loadingCoverFade + HOLD_DURATION_MS.illustrationReveal);
    expect(steps[1].durationMs).toBe(MOTION_DURATION_MS.stageZoom + HOLD_DURATION_MS.stageZoom);
    expect(steps[3].durationMs).toBe(MOTION_DURATION_MS.logoDraw + HOLD_DURATION_MS.logo);
  });

  test("reduced motion disables the zoom, warm-up and desktop reveal motion but keeps their hold durations", () => {
    const steps = sequence(REDUCED_MOTION_DURATION_MS);

    expect(steps[1].durationMs).toBe(HOLD_DURATION_MS.stageZoom);
    expect(steps[2].durationMs).toBe(HOLD_DURATION_MS.displayOn);
    expect(steps[5].durationMs).toBe(0);
  });
});

describe("startOfPhaseMs", () => {
  const steps = sequence(MOTION_DURATION_MS);
  const runMs = steps.reduce((total, { durationMs }) => total + durationMs, 0);

  test("the first phase begins as the sequence starts", () => {
    expect(startOfPhaseMs(steps, "macintosh-reveal")).toBe(0);
  });

  test("a later phase begins once the steps before it have run", () => {
    expect(startOfPhaseMs(steps, "display-on")).toBe(steps[0].durationMs + steps[1].durationMs);
    expect(startOfPhaseMs(steps, "desktop-reveal")).toBe(runMs - steps[5].durationMs);
  });

  test("a phase the sequence does not step to begins once the run is over", () => {
    expect(startOfPhaseMs(steps, "complete")).toBe(runMs);
  });
});
