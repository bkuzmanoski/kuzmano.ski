import { describe, expect, test } from "vitest";

import {
  careerTimelineScrollRangeOf,
  scrollTopForVisibleCareerTimelineCenter,
  visibleCareerTimelineCenterAfterTravel,
  visibleCareerTimelinePlacementAt,
  visibleCareerTimelinePlacementOf,
} from "./career-timeline-viewport.ts";
import { careerTimelinePlacementCenterOf } from "./career-timeline.ts";

import type { CareerTimelineViewport, LaidOutRole } from "./career-timeline-viewport.ts";

const laidOutRole = (top: number, height: number, offset: number, size: number): LaidOutRole => ({
  top,
  height,
  placement: { offset, size },
});

describe("visibleCareerTimelinePlacementOf", () => {
  test("returns a role's whole placement when all of the role is in view", () => {
    const placement = visibleCareerTimelinePlacementOf([laidOutRole(100, 200, 0.1, 0.2)], 0, 1000);

    expect(placement?.offset).toBeCloseTo(0.1);
    expect(placement?.size).toBeCloseTo(0.2);
  });

  test("returns the share of a role's placement equal to the share of its height in view", () => {
    const placement = visibleCareerTimelinePlacementOf([laidOutRole(0, 200, 0.2, 0.4)], 100, 1000);

    expect(placement?.offset).toBeCloseTo(0.4);
    expect(placement?.size).toBeCloseTo(0.2);
  });

  test("returns one placement spanning roles in view whose placements overlap", () => {
    const placement = visibleCareerTimelinePlacementOf(
      [laidOutRole(0, 100, 0.1, 0.3), laidOutRole(100, 100, 0.2, 0.5)],
      0,
      200,
    );

    expect(placement?.offset).toBeCloseTo(0.1);
    expect(placement?.size).toBeCloseTo(0.6);
  });

  test("excludes a role outside the view", () => {
    const placement = visibleCareerTimelinePlacementOf(
      [laidOutRole(0, 100, 0.1, 0.1), laidOutRole(500, 100, 0.8, 0.1)],
      0,
      200,
    );

    expect(placement?.offset).toBeCloseTo(0.1);
    expect(placement?.size).toBeCloseTo(0.1);
  });

  test("excludes a role whose height is `0`", () => {
    expect(visibleCareerTimelinePlacementOf([laidOutRole(0, 0, 0.1, 0.1)], 0, 200)).toBeNull();
  });

  test("returns `null` when no role is in view", () => {
    expect(visibleCareerTimelinePlacementOf([laidOutRole(500, 100, 0.1, 0.1)], 0, 200)).toBeNull();
  });
});

const viewportOf = (
  roles: ReadonlyArray<LaidOutRole>,
  overrides: Partial<CareerTimelineViewport> = {},
): CareerTimelineViewport => ({
  roles,
  scrollTop: 0,
  viewTopOffset: 0,
  viewBottomOffset: 500,
  minimumViewTop: null,
  ...overrides,
});

describe("careerTimelineScrollRangeOf", () => {
  test("returns the scroll range spanning the first and last roles", () => {
    const viewport = viewportOf([laidOutRole(100, 200, 0, 0.5), laidOutRole(340, 200, 0.5, 0.5)], {
      scrollTop: 150,
      viewTopOffset: 16,
      viewBottomOffset: 184,
    });
    expect(careerTimelineScrollRangeOf(viewport)).toEqual({ minimumScrollTop: 84, maximumScrollTop: 356 });
  });

  test("returns a single scroll position when the roles fit within the view", () => {
    const viewport = viewportOf([laidOutRole(100, 50, 0, 1)], {
      scrollTop: 84,
      viewTopOffset: 16,
      viewBottomOffset: 484,
    });
    expect(careerTimelineScrollRangeOf(viewport)).toEqual({ minimumScrollTop: 84, maximumScrollTop: 84 });
  });

  test("includes the measured scroll position when the first role has not reached the view top", () => {
    const viewport = viewportOf([laidOutRole(400, 300, 0, 0.5), laidOutRole(740, 300, 0.5, 0.5)], { scrollTop: 0 });
    expect(careerTimelineScrollRangeOf(viewport)?.minimumScrollTop).toBe(0);
  });

  test("includes the measured scroll position when it is after the last role reaches the view bottom", () => {
    const viewport = viewportOf([laidOutRole(0, 300, 0, 0.5), laidOutRole(340, 300, 0.5, 0.5)], { scrollTop: 400 });
    expect(careerTimelineScrollRangeOf(viewport)?.maximumScrollTop).toBe(400);
  });

  test("returns `null` for a viewport without roles", () => {
    expect(careerTimelineScrollRangeOf(viewportOf([]))).toBeNull();
  });
});

describe("visibleCareerTimelinePlacementAt", () => {
  test("measures the view's top and bottom as `viewTopOffset` and `viewBottomOffset` below the scroll position", () => {
    const viewport = viewportOf([laidOutRole(0, 400, 0.1, 0.4)], { viewTopOffset: 10, viewBottomOffset: 110 });
    const placement = visibleCareerTimelinePlacementAt(viewport, 90);

    expect(placement?.offset).toBeCloseTo(0.2);
    expect(placement?.size).toBeCloseTo(0.1);
  });

  test("starts the view at `minimumViewTop` until `viewTopOffset` below the scroll position passes it", () => {
    const viewport = viewportOf([laidOutRole(0, 400, 0.1, 0.4)], {
      viewTopOffset: 50,
      viewBottomOffset: 300,
      minimumViewTop: 100,
    });

    expect(visibleCareerTimelinePlacementAt(viewport, 0)?.offset).toBeCloseTo(0.2);
    expect(visibleCareerTimelinePlacementAt(viewport, 100)?.offset).toBeCloseTo(0.25);
  });
});

describe("visibleCareerTimelineCenterAfterTravel", () => {
  test("moves the press center along the chart by the pointer's travel as a fraction of the axis length", () => {
    expect(visibleCareerTimelineCenterAfterTravel(0.5, 30, 300)).toBeCloseTo(0.6);
    expect(visibleCareerTimelineCenterAfterTravel(0.5, -30, 300)).toBeCloseTo(0.4);
  });

  test("returns the press center unchanged when the pointer's travel is `0`", () => {
    expect(visibleCareerTimelineCenterAfterTravel(0.5, 0, 300)).toBe(0.5);
  });
});

describe("scrollTopForVisibleCareerTimelineCenter", () => {
  const viewport = viewportOf(
    [
      laidOutRole(0, 300, 0, 0.2),
      laidOutRole(340, 300, 0.2, 0.5),
      laidOutRole(680, 300, 0.5, 0.3),
      laidOutRole(1020, 300, 0.6, 0.4),
    ],
    { scrollTop: 400, viewTopOffset: 16, viewBottomOffset: 484 },
  );
  const minimumScrollTop = -16;
  const maximumScrollTop = 836;

  const centerAt = (scrollTop: number) => {
    const placement = visibleCareerTimelinePlacementAt(viewport, scrollTop);
    return placement ? careerTimelinePlacementCenterOf(placement) : Number.NaN;
  };

  test("returns the maximum scroll position for a target center equal to the frame's center at that position", () => {
    expect(scrollTopForVisibleCareerTimelineCenter(viewport, centerAt(maximumScrollTop))).toBe(maximumScrollTop);
  });

  test("returns the maximum scroll position for a target center past the frame's center at that position", () => {
    expect(scrollTopForVisibleCareerTimelineCenter(viewport, centerAt(maximumScrollTop) + 0.1)).toBe(maximumScrollTop);
  });

  test("returns the minimum scroll position for a target center equal to the frame's center at that position", () => {
    expect(scrollTopForVisibleCareerTimelineCenter(viewport, centerAt(minimumScrollTop))).toBe(minimumScrollTop);
  });

  test("returns the minimum scroll position for a target center before the frame's center at that position", () => {
    expect(scrollTopForVisibleCareerTimelineCenter(viewport, centerAt(minimumScrollTop) - 0.1)).toBe(minimumScrollTop);
  });

  test("returns a scroll position within the range for a target center equal to the frame's center at that position", () => {
    expect(scrollTopForVisibleCareerTimelineCenter(viewport, centerAt(400))).toBeCloseTo(400, 3);
  });

  test("returns the maximum scroll position for a drag pressed at that position before its pointer travels", () => {
    const center = visibleCareerTimelineCenterAfterTravel(centerAt(maximumScrollTop), 0, 400);
    expect(scrollTopForVisibleCareerTimelineCenter(viewport, center)).toBe(maximumScrollTop);
  });

  test("returns the scroll position of the press for a drag pressed within the range before its pointer travels", () => {
    const center = visibleCareerTimelineCenterAfterTravel(centerAt(viewport.scrollTop), 0, 400);
    expect(scrollTopForVisibleCareerTimelineCenter(viewport, center)).toBeCloseTo(viewport.scrollTop, 3);
  });

  test("returns `null` for a viewport without roles", () => {
    expect(scrollTopForVisibleCareerTimelineCenter(viewportOf([]), 0.5)).toBeNull();
  });
});
