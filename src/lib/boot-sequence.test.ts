import { describe, expect, test } from "vitest";

import { HOLD_MS, MOTION_MS, REDUCED_MOTION_MS, phaseFlags, sequence } from "./boot-sequence";

describe("phaseFlags", () => {
  test("the loading cover stays up until the illustration is revealed", () => {
    expect(phaseFlags("loading").isLoadingCoverUp).toBe(true);
    expect(phaseFlags("waiting-for-input").isLoadingCoverUp).toBe(true);
    expect(phaseFlags("macintosh-reveal").isLoadingCoverUp).toBe(false);
  });

  test("the display warms up for exactly one phase and then stays on", () => {
    expect(phaseFlags("macintosh-reveal").isDisplayOn).toBe(false);
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

describe("sequence", () => {
  test("steps through the phases in order, ending before complete", () => {
    expect(sequence(MOTION_MS).map(({ phase }) => phase)).toEqual([
      "macintosh-reveal",
      "display-on",
      "logo",
      "glass-fade",
      "desktop-reveal",
    ]);
  });

  test("each step holds for its motion plus its hold time", () => {
    const steps = sequence(MOTION_MS);

    expect(steps[0].durationMs).toBe(MOTION_MS.loadingCoverFade + HOLD_MS.illustrationReveal);
    expect(steps[2].durationMs).toBe(MOTION_MS.logoDraw + HOLD_MS.logo);
  });

  test("reduced motion removes the warm-up and desktop reveal motion but keeps the holds", () => {
    const steps = sequence(REDUCED_MOTION_MS);

    expect(steps[1].durationMs).toBe(HOLD_MS.displayOn);
    expect(steps[4].durationMs).toBe(0);
  });
});
