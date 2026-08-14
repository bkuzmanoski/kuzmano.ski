import { describe, expect, test } from "vitest";

import { SPOTLIGHT_SPILL, stageMetricsFor } from "./stage";

import type { Rect, Size, Transform } from "../geometry";

const WIDE_VIEWPORT: Size = { width: 1440, height: 900 };
const TALL_VIEWPORT: Size = { width: 430, height: 932 };
const PORTRAIT_VIEWPORT: Size = { width: 390, height: 844 };
const LANDSCAPE_VIEWPORT: Size = { width: 844, height: 390 };
const VIEWPORTS = [WIDE_VIEWPORT, TALL_VIEWPORT, PORTRAIT_VIEWPORT, LANDSCAPE_VIEWPORT];

const ILLUSTRATION_ASPECT_RATIO = 1214 / 1067;
const DISPLAY_PLACEMENT: Rect = { x: 330 / 1214, y: 99 / 1067, width: 554 / 1214, height: 410 / 1067 };
const APPLE_LOGO_BOTTOM = 735 / 1067;
const DISK_DRIVE_BOTTOM = 692 / 1067;

/* Applies a transform the way the compositor does, for an origin at the viewport's top-left corner. */
const transformed = ({ scale, x, y }: Transform, box: Rect): Rect => ({
  x: box.x * scale + x,
  y: box.y * scale + y,
  width: box.width * scale,
  height: box.height * scale,
});

const zoomedInBoxFor = (viewport: Size) => stageMetricsFor(viewport).illustration;
const zoomedOutBoxFor = (viewport: Size) => {
  const { illustration, zoomOut } = stageMetricsFor(viewport);
  return transformed(zoomOut, illustration);
};

describe("stageMetricsFor", () => {
  test("places the display over the cutout in the illustration", () => {
    for (const viewport of VIEWPORTS) {
      const { illustration, display } = stageMetricsFor(viewport);

      expect(display.x - illustration.x).toBeCloseTo(illustration.width * DISPLAY_PLACEMENT.x);
      expect(display.y - illustration.y).toBeCloseTo(illustration.height * DISPLAY_PLACEMENT.y);
      expect(display.width).toBeCloseTo(illustration.width * DISPLAY_PLACEMENT.width);
      expect(display.height).toBeCloseTo(illustration.height * DISPLAY_PLACEMENT.height);
    }
  });

  test("keeps the display inside the illustration", () => {
    for (const viewport of VIEWPORTS) {
      const { illustration, display } = stageMetricsFor(viewport);

      expect(display.x).toBeGreaterThan(illustration.x);
      expect(display.y).toBeGreaterThan(illustration.y);
      expect(display.x + display.width).toBeLessThan(illustration.x + illustration.width);
      expect(display.y + display.height).toBeLessThan(illustration.y + illustration.height);
    }
  });

  test("reports the scale the illustration is rendered at", () => {
    for (const viewport of VIEWPORTS) {
      const { illustration, scale } = stageMetricsFor(viewport);

      expect(illustration.width).toBeCloseTo(1214 * scale);
      expect(illustration.height).toBeCloseTo(1067 * scale);
    }
  });

  test("carries the viewport it was measured for", () => {
    expect(stageMetricsFor(WIDE_VIEWPORT).viewport).toEqual(WIDE_VIEWPORT);
  });

  test("zooms out to a smaller illustration than the one it zooms in to", () => {
    for (const viewport of VIEWPORTS) {
      expect(stageMetricsFor(viewport).zoomOut.scale).toBeLessThan(1);
    }
  });
});

describe("the zoomed out framing", () => {
  test("fits the entire illustration in a wide viewport", () => {
    const box = zoomedOutBoxFor(WIDE_VIEWPORT);

    expect(box.height).toBeCloseTo(0.9 * WIDE_VIEWPORT.height);
    expect(box.width / box.height).toBeCloseTo(ILLUSTRATION_ASPECT_RATIO);
    expect(box.x + box.width / 2).toBeCloseTo(WIDE_VIEWPORT.width / 2);
    expect(box.y + box.height / 2).toBeCloseTo(WIDE_VIEWPORT.height / 2);
  });

  test("extends past the sides of a narrow viewport rather than shrinking the illustration", () => {
    const box = zoomedOutBoxFor(PORTRAIT_VIEWPORT);

    expect(box.width).toBeCloseTo(1.4 * PORTRAIT_VIEWPORT.width);
    expect(box.x).toBeLessThan(0);
  });

  test("keeps the whole illustration in view on every viewport", () => {
    for (const viewport of VIEWPORTS) {
      const box = zoomedOutBoxFor(viewport);

      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
  });
});

describe("the zoomed in framing", () => {
  test("places the display in the middle of the viewport", () => {
    for (const viewport of VIEWPORTS) {
      const { display } = stageMetricsFor(viewport);

      expect(display.x + display.width / 2).toBeCloseTo(viewport.width / 2);
      expect(display.x).toBeGreaterThan(0);
      expect(display.y).toBeGreaterThan(0);
      expect(display.y + display.height).toBeLessThan(viewport.height);
    }
  });

  test("keeps the Apple logo and disk drive in view", () => {
    for (const viewport of VIEWPORTS) {
      const { illustration, display } = stageMetricsFor(viewport);

      expect(illustration.y + illustration.height * DISK_DRIVE_BOTTOM).toBeGreaterThan(display.y + display.height);
      expect(illustration.y + illustration.height * APPLE_LOGO_BOTTOM).toBeLessThan(viewport.height);
    }
  });

  test("gives the display more of the viewport than the zoomed out framing does", () => {
    for (const viewport of VIEWPORTS) {
      const zoomedOutDisplayWidth = zoomedOutBoxFor(viewport).width * DISPLAY_PLACEMENT.width;

      expect(stageMetricsFor(viewport).display.width).toBeGreaterThan(zoomedOutDisplayWidth * 1.15);
    }
  });

  test("fills the viewport's binding axis with the display: its width when narrow, its height when wide", () => {
    expect(stageMetricsFor(PORTRAIT_VIEWPORT).display.width).toBeGreaterThan(0.75 * PORTRAIT_VIEWPORT.width);
    expect(stageMetricsFor(WIDE_VIEWPORT).display.height).toBeGreaterThan(0.45 * WIDE_VIEWPORT.height);
    expect(stageMetricsFor(LANDSCAPE_VIEWPORT).display.height).toBeGreaterThan(0.45 * LANDSCAPE_VIEWPORT.height);
  });
});

describe("the vertical placement of both framings", () => {
  const boxesFor = (viewport: Size) => [zoomedOutBoxFor(viewport), zoomedInBoxFor(viewport)];
  const spaceBelowSpotlight = (box: Rect, viewport: Size) =>
    viewport.height - (box.y + box.height * (1 + SPOTLIGHT_SPILL));

  test("centres the illustration and the spotlight underneath it when the width is what binds", () => {
    for (const viewport of [PORTRAIT_VIEWPORT, TALL_VIEWPORT]) {
      for (const box of boxesFor(viewport)) {
        expect(spaceBelowSpotlight(box, viewport)).toBeCloseTo(box.y);
      }
    }
  });

  test("places the illustration above its own centre, allowing the spotlight to fall below it", () => {
    for (const viewport of [PORTRAIT_VIEWPORT, TALL_VIEWPORT]) {
      for (const box of boxesFor(viewport)) {
        expect(box.y).toBeLessThan((viewport.height - box.height) / 2); // Where centring the illustration alone would put it.
      }
    }
  });

  test("holds a minimum margin above the illustration", () => {
    for (const viewport of [WIDE_VIEWPORT, LANDSCAPE_VIEWPORT]) {
      for (const box of boxesFor(viewport)) {
        expect(box.y).toBeGreaterThan(0);
        expect(box.y).toBeGreaterThan((viewport.height - box.height * (1 + SPOTLIGHT_SPILL)) / 2); // Centring the composition would reach past the top of the viewport, so the margin is holding it down.
      }
    }
  });
});
