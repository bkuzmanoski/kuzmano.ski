import { useEffect } from "react";

import { SCROLL_PANE_VIEWPORT_SELECTOR } from "#/features/windows/scroll-pane.tsx";
import { recordScrollAt, silenceScrollAt } from "#/lib/audio/scroll.ts";
import { playClick } from "#/lib/audio/sounds.ts";
import {
  careerTimelinePlacementCenterOf,
  scrollTopForVisibleCareerTimelineCenter,
  visibleCareerTimelineCenterAfterTravel,
  visibleCareerTimelinePlacementAt,
} from "#/lib/experience/career-timeline.ts";
import type { CareerTimelineDirection } from "#/lib/experience/career-timeline.ts";
import { usePointerDrag } from "#/lib/hooks/use-pointer-drag.ts";

import { axisFractionAt, readCareerTimelineLayout } from "./career-timeline-layout.ts";

import type { CareerTimelineLayout, CareerTimelineLayoutElements } from "./career-timeline-layout.ts";
import type { RefObject } from "react";

export interface CareerTimelineMinimapElements extends CareerTimelineLayoutElements {
  visibleRangeFrame: RefObject<HTMLSpanElement | null>;
}

/** The state of `CareerTimeline` that reorders or filters the list without scrolling the scroll pane. */
export interface CareerTimelineListState {
  direction: CareerTimelineDirection;
  hiddenDisciplineIds: ReadonlySet<string>;
}

const scrollPaneOf = (listElement: HTMLElement | null): HTMLElement | null =>
  listElement?.closest(SCROLL_PANE_VIEWPORT_SELECTOR) ?? null;

// Scrolls so the visible-range frame is centered on `center`. The roles' positions are in the scroll pane's
// scrolled coordinates, so a layout read at the start of a drag remains valid for the duration of the drag.
function scrollToVisibleCareerTimelineCenter(layout: CareerTimelineLayout, center: number) {
  const scrollTop = scrollTopForVisibleCareerTimelineCenter(layout.viewport, center);

  if (scrollTop !== null) {
    layout.scrollPane.scrollTop = scrollTop;
  }
}

/**
 * Keeps the visible-range frame around the years of the roles in view of the scroll pane, and returns the
 * pointer handlers that make the chart scroll the list.
 *
 * The frame is measured on each scroll and resize frame, and again when `listState` changes, and is marked
 * `data-visible` while a role is in view.
 */
export function useCareerTimelineMinimap(
  { chartColumn, lanes, visibleRangeFrame, list }: CareerTimelineMinimapElements,
  { direction, hiddenDisciplineIds }: CareerTimelineListState,
) {
  useEffect(() => {
    const layoutElements = { chartColumn, lanes, list };
    const visibleRangeFrameElement = visibleRangeFrame.current;
    const listElement = list.current;
    const scrollPane = scrollPaneOf(listElement);

    if (!visibleRangeFrameElement) {
      return;
    }

    if (!listElement || !scrollPane) {
      visibleRangeFrameElement.removeAttribute("data-visible");
      return;
    }

    let animationFrameId = 0;

    const measureVisibleRange = () => {
      animationFrameId = 0;

      const layout = readCareerTimelineLayout(scrollPane, layoutElements);
      const visiblePlacement = layout && visibleCareerTimelinePlacementAt(layout.viewport, layout.viewport.scrollTop);

      if (visiblePlacement) {
        visibleRangeFrameElement.style.setProperty(
          "--career-timeline-placement-offset",
          String(visiblePlacement.offset),
        );
        visibleRangeFrameElement.style.setProperty("--career-timeline-placement-size", String(visiblePlacement.size));
        visibleRangeFrameElement.setAttribute("data-visible", "");
      } else {
        visibleRangeFrameElement.removeAttribute("data-visible");
      }
    };

    const scheduleVisibleRangeMeasurement = () => {
      if (animationFrameId === 0) {
        animationFrameId = requestAnimationFrame(measureVisibleRange);
      }
    };

    measureVisibleRange();
    scrollPane.addEventListener("scroll", scheduleVisibleRangeMeasurement, { passive: true });

    const resizeObserver = new ResizeObserver(scheduleVisibleRangeMeasurement);

    resizeObserver.observe(scrollPane);
    resizeObserver.observe(listElement);

    return () => {
      cancelAnimationFrame(animationFrameId);
      scrollPane.removeEventListener("scroll", scheduleVisibleRangeMeasurement);
      resizeObserver.disconnect();
    };

    // The list state is not read here, but a change to it reorders or filters the
    // roles and moves their placements without scrolling or resizing the scroll pane.
  }, [chartColumn, lanes, visibleRangeFrame, list, direction, hiddenDisciplineIds]);

  return usePointerDrag({
    preventDefault: true,
    start: (event) => {
      const scrollPane = scrollPaneOf(list.current);
      const layout = scrollPane && readCareerTimelineLayout(scrollPane, { chartColumn, lanes, list });

      if (!layout) {
        return null;
      }

      const pressFraction = axisFractionAt(layout.axis, event.clientX, event.clientY);
      const visiblePlacement = visibleCareerTimelinePlacementAt(layout.viewport, layout.viewport.scrollTop);
      const isPressOnVisibleRangeFrame =
        visiblePlacement !== null &&
        pressFraction >= visiblePlacement.offset &&
        pressFraction <= visiblePlacement.offset + visiblePlacement.size;

      playClick();

      if (!isPressOnVisibleRangeFrame) {
        silenceScrollAt(layout.scrollPane);
        scrollToVisibleCareerTimelineCenter(layout, pressFraction);
      }

      return {
        layout,
        pressCenter: isPressOnVisibleRangeFrame ? careerTimelinePlacementCenterOf(visiblePlacement) : pressFraction,
        isScrollSoundSilenced: !isPressOnVisibleRangeFrame,
      };
    },
    onDragMove: ({ dx, dy }, drag) => {
      if (!drag) {
        return;
      }

      if (drag.isScrollSoundSilenced) {
        drag.isScrollSoundSilenced = false;
        recordScrollAt(drag.layout.scrollPane); // Resume scroll sounds after a jump.
      }

      const { layout, pressCenter } = drag;
      const pointerTravelPx = layout.axis.isHorizontal ? dx : dy;

      scrollToVisibleCareerTimelineCenter(
        layout,
        visibleCareerTimelineCenterAfterTravel(pressCenter, pointerTravelPx, layout.axis.lengthPx),
      );
    },
  });
}
