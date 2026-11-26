import { useEffect } from "react";

import { SCROLL_PANE_VIEWPORT_SELECTOR } from "#/features/window-manager/scroll-pane.tsx";
import { createFrameScheduler } from "#/lib/animation-frames.ts";
import { recordScrollAt, silenceScrollAt } from "#/lib/audio/scroll.ts";
import { playClickSound } from "#/lib/audio/sounds.ts";
import {
  scrollTopForVisibleCareerTimelineCenter,
  visibleCareerTimelineCenterAfterTravel,
  visibleCareerTimelinePlacementAt,
} from "#/lib/experience/career-timeline-viewport.ts";
import { careerTimelinePlacementCenterOf } from "#/lib/experience/career-timeline.ts";
import type { CareerTimelineDirection } from "#/lib/experience/career-timeline.ts";
import { useAxisDrag } from "#/lib/press/use-axis-drag.ts";
import type { DragDelta } from "#/lib/press/use-pointer-drag.ts";

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

interface ChartPress {
  layout: CareerTimelineLayout;
  /** The fraction of the chart's axis that the visible-range frame centers on before the pointer travels. */
  pressCenter: number;
  isPressOnVisibleRangeFrame: boolean;
  /** The scroll position to restore if the drag is canceled. */
  startScrollTop: number;
  isScrollSoundSilenced: boolean;
}

const scrollPaneOf = (listElement: HTMLElement | null): HTMLElement | null =>
  listElement?.closest(SCROLL_PANE_VIEWPORT_SELECTOR) ?? null;

/**
 * Scrolls the scroll pane so the visible-range frame centers on `center`. The roles' positions are in the scroll pane's
 * scrolled coordinates, so a layout read at the start of a drag remains valid for the duration of the drag.
 */
function scrollToVisibleCareerTimelineCenter(layout: CareerTimelineLayout, center: number) {
  const scrollTop = scrollTopForVisibleCareerTimelineCenter(layout.viewport, center);

  if (scrollTop !== null) {
    layout.scrollPane.scrollTop = scrollTop;
  }
}

/** Scrolls the list so the visible-range frame centers on the press center moved by `delta` along the chart's axis. */
function scrollListAlongChart(press: ChartPress, { dx, dy }: DragDelta) {
  const { layout, pressCenter } = press;
  scrollToVisibleCareerTimelineCenter(
    layout,
    visibleCareerTimelineCenterAfterTravel(pressCenter, layout.axis.isHorizontal ? dx : dy, layout.axis.lengthPx),
  );
}

/**
 * Keeps the visible-range frame around the years of the roles in view of the scroll pane, and returns the pointer
 * handlers that make the chart scroll the list.
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

    const measureVisibleRange = () => {
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

    const measurement = createFrameScheduler(measureVisibleRange);

    measureVisibleRange();
    scrollPane.addEventListener("scroll", measurement.schedule, { passive: true });

    const resizeObserver = new ResizeObserver(measurement.schedule);

    resizeObserver.observe(scrollPane);
    resizeObserver.observe(listElement);

    return () => {
      measurement.stop();
      scrollPane.removeEventListener("scroll", measurement.schedule);
      resizeObserver.disconnect();
    };

    // The list state is not read here, but a change to it reorders or filters the roles and moves their placements
    // without scrolling or resizing the scroll pane.
  }, [chartColumn, lanes, visibleRangeFrame, list, direction, hiddenDisciplineIds]);

  // A touch press waits to scroll the list, as the browser can still cancel the gesture to scroll the scroll pane where
  // the chart allows it with `touch-action`.
  return useAxisDrag<ChartPress>({
    axis: (press) => (press.layout.axis.isHorizontal ? "x" : "y"),
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

      return {
        layout,
        pressCenter: isPressOnVisibleRangeFrame ? careerTimelinePlacementCenterOf(visiblePlacement) : pressFraction,
        isPressOnVisibleRangeFrame,
        startScrollTop: layout.scrollPane.scrollTop,
        isScrollSoundSilenced: false,
      };
    },
    onBegin: (press, delta) => {
      playClickSound();

      // A press away from the visible-range frame jumps the list to the press, without playing the scroll sound until
      // the next move. A press on the frame scrolls the list only once the pointer travels.
      if (!press.isPressOnVisibleRangeFrame) {
        press.isScrollSoundSilenced = true;
        silenceScrollAt(press.layout.scrollPane);
        scrollListAlongChart(press, delta);
      } else if (delta.dx !== 0 || delta.dy !== 0) {
        scrollListAlongChart(press, delta);
      }
    },
    onDragMove: (delta, press) => {
      if (press.isScrollSoundSilenced) {
        press.isScrollSoundSilenced = false;
        recordScrollAt(press.layout.scrollPane); // Resume scroll sounds after a jump.
      }

      scrollListAlongChart(press, delta);
    },
    onEnd: ({ start: press, isCanceled }) => {
      if (isCanceled) {
        silenceScrollAt(press.layout.scrollPane);
        press.layout.scrollPane.scrollTop = press.startScrollTop;
      }
    },
  });
}
