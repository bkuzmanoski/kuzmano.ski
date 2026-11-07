import { clamp } from "../math.ts";

import { careerTimelinePlacementCenterOf } from "./career-timeline.ts";

import type { CareerTimelinePlacement } from "./career-timeline.ts";

export interface LaidOutRole {
  top: number;
  height: number;
  placement: CareerTimelinePlacement;
}

export interface CareerTimelineViewport {
  roles: ReadonlyArray<LaidOutRole>;
  scrollTop: number;
  viewTopOffset: number;
  viewBottomOffset: number;
  minimumViewTop: number | null;
}

export interface CareerTimelineScrollRange {
  minimumScrollTop: number;
  maximumScrollTop: number;
}

export function visibleCareerTimelinePlacementOf(
  roles: ReadonlyArray<LaidOutRole>,
  viewTop: number,
  viewBottom: number,
): CareerTimelinePlacement | null {
  let frameStartOffset = Number.POSITIVE_INFINITY;
  let frameEndOffset = Number.NEGATIVE_INFINITY;

  for (const { top, height, placement } of roles) {
    if (height <= 0) {
      continue;
    }

    const visibleStartFraction = clamp((viewTop - top) / height, 0, 1);
    const visibleEndFraction = clamp((viewBottom - top) / height, 0, 1);

    if (visibleEndFraction <= visibleStartFraction) {
      continue;
    }

    frameStartOffset = Math.min(frameStartOffset, placement.offset + visibleStartFraction * placement.size);
    frameEndOffset = Math.max(frameEndOffset, placement.offset + visibleEndFraction * placement.size);
  }

  return frameEndOffset > frameStartOffset
    ? { offset: frameStartOffset, size: frameEndOffset - frameStartOffset }
    : null;
}

export const visibleCareerTimelinePlacementAt = (
  { roles, viewTopOffset, viewBottomOffset, minimumViewTop }: CareerTimelineViewport,
  scrollTop: number,
): CareerTimelinePlacement | null =>
  visibleCareerTimelinePlacementOf(
    roles,
    Math.max(minimumViewTop ?? Number.NEGATIVE_INFINITY, scrollTop + viewTopOffset),
    scrollTop + viewBottomOffset,
  );

export const visibleCareerTimelineCenterAfterTravel = (
  pressCenter: number,
  pointerTravelPx: number,
  axisLengthPx: number,
): number => pressCenter + pointerTravelPx / axisLengthPx;

export function careerTimelineScrollRangeOf({
  roles,
  scrollTop,
  viewTopOffset,
  viewBottomOffset,
}: CareerTimelineViewport): CareerTimelineScrollRange | null {
  const firstRole = roles[0];
  const lastRole = roles.at(-1);

  if (!firstRole || !lastRole) {
    return null;
  }

  const listStartScrollTop = firstRole.top - viewTopOffset;
  const listEndScrollTop = Math.max(listStartScrollTop, lastRole.top + lastRole.height - viewBottomOffset);

  return {
    minimumScrollTop: Math.min(scrollTop, listStartScrollTop),
    maximumScrollTop: Math.max(scrollTop, listEndScrollTop),
  };
}

export function scrollTopForVisibleCareerTimelineCenter(
  viewport: CareerTimelineViewport,
  targetCenter: number,
): number | null {
  const scrollRange = careerTimelineScrollRangeOf(viewport);

  if (!scrollRange) {
    return null;
  }

  const { minimumScrollTop, maximumScrollTop } = scrollRange;
  const frameCenterAt = (scrollTop: number) => {
    const visiblePlacement = visibleCareerTimelinePlacementAt(viewport, scrollTop);
    return visiblePlacement && careerTimelinePlacementCenterOf(visiblePlacement);
  };

  const frameCenterAtMinimum = frameCenterAt(minimumScrollTop);
  const frameCenterAtMaximum = frameCenterAt(maximumScrollTop);

  if (frameCenterAtMinimum === null || targetCenter <= frameCenterAtMinimum) {
    return minimumScrollTop;
  }

  if (frameCenterAtMaximum === null || targetCenter >= frameCenterAtMaximum) {
    return maximumScrollTop;
  }

  let scrollTopBeforeTarget = minimumScrollTop;
  let scrollTopAtOrPastTarget = maximumScrollTop;

  const iterationCount = 32;

  for (let iteration = 0; iteration < iterationCount; iteration++) {
    const middleScrollTop = (scrollTopBeforeTarget + scrollTopAtOrPastTarget) / 2;
    const frameCenterAtMiddle = frameCenterAt(middleScrollTop);

    if (frameCenterAtMiddle !== null && frameCenterAtMiddle >= targetCenter) {
      scrollTopAtOrPastTarget = middleScrollTop;
    } else {
      scrollTopBeforeTarget = middleScrollTop;
    }
  }

  return scrollTopAtOrPastTarget;
}
