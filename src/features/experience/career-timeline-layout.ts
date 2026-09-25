import type { CareerTimelinePlacement, CareerTimelineViewport } from "#/lib/experience/career-timeline.ts";

import type { RefObject } from "react";

export interface CareerTimelineAxis {
  isHorizontal: boolean;
  startPx: number;
  lengthPx: number;
}

export interface CareerTimelineLayout {
  scrollPane: HTMLElement;
  viewport: CareerTimelineViewport;
  axis: CareerTimelineAxis;
}

export interface CareerTimelineLayoutElements {
  chartColumn: RefObject<HTMLDivElement | null>;
  lanes: RefObject<HTMLDivElement | null>;
  list: RefObject<HTMLOListElement | null>;
}

export const axisFractionAt = (
  { isHorizontal, startPx, lengthPx }: CareerTimelineAxis,
  clientX: number,
  clientY: number,
) => ((isHorizontal ? clientX : clientY) - startPx) / lengthPx;

const PLACEMENT_OFFSET_ATTRIBUTE = "data-career-timeline-placement-offset";
const PLACEMENT_SIZE_ATTRIBUTE = "data-career-timeline-placement-size";

export const careerTimelinePlacementAttributesOf = ({ offset, size }: CareerTimelinePlacement) => ({
  [PLACEMENT_OFFSET_ATTRIBUTE]: offset,
  [PLACEMENT_SIZE_ATTRIBUTE]: size,
});

const pixelsOf = (length: string): number => Number.parseFloat(length) || 0;

function careerTimelinePlacementOfElement(element: Element): CareerTimelinePlacement | null {
  const offset = element.getAttribute(PLACEMENT_OFFSET_ATTRIBUTE);
  const size = element.getAttribute(PLACEMENT_SIZE_ATTRIBUTE);

  return offset === null || size === null ? null : { offset: Number(offset), size: Number(size) };
}

const careerTimelineAxisOf = (lanesRect: DOMRect, isHorizontal: boolean): CareerTimelineAxis =>
  isHorizontal
    ? { isHorizontal, startPx: lanesRect.left, lengthPx: lanesRect.width }
    : { isHorizontal, startPx: lanesRect.top, lengthPx: lanesRect.height };

export function readCareerTimelineLayout(
  scrollPane: HTMLElement,
  elements: CareerTimelineLayoutElements,
): CareerTimelineLayout | null {
  const chartColumnElement = elements.chartColumn.current;
  const lanesElement = elements.lanes.current;
  const listElement = elements.list.current;

  if (!chartColumnElement || !lanesElement || !listElement) {
    return null;
  }

  const scrollPaneRect = scrollPane.getBoundingClientRect();
  const scrollPaneStyle = getComputedStyle(scrollPane);
  const scrollPaddingTop = pixelsOf(scrollPaneStyle.scrollPaddingTop);
  const scrollPaddingBottom = pixelsOf(scrollPaneStyle.scrollPaddingBottom);

  const chartColumnRect = chartColumnElement.getBoundingClientRect();
  const chartColumnStickyTop = pixelsOf(getComputedStyle(chartColumnElement).top);
  const listRect = listElement.getBoundingClientRect();

  const isChartAboveList = chartColumnRect.right > listRect.left && chartColumnRect.left < listRect.right;
  const isChartColumnStuck = chartColumnRect.top - scrollPaneRect.top <= chartColumnStickyTop;

  const scrollPaneYOf = (clientY: number) => clientY - scrollPaneRect.top + scrollPane.scrollTop;

  return {
    scrollPane,
    viewport: {
      roles: [...listElement.children].flatMap((item) => {
        const placement = careerTimelinePlacementOfElement(item);
        const { top, height } = item.getBoundingClientRect();

        return placement ? [{ top: scrollPaneYOf(top), height, placement }] : [];
      }),
      scrollTop: scrollPane.scrollTop,
      viewTopOffset: (isChartAboveList ? chartColumnStickyTop + chartColumnRect.height : 0) + scrollPaddingTop,
      viewBottomOffset: scrollPaneRect.height - scrollPaddingBottom,
      minimumViewTop:
        isChartAboveList && !isChartColumnStuck ? scrollPaneYOf(chartColumnRect.bottom) + scrollPaddingTop : null,
    },
    axis: careerTimelineAxisOf(lanesElement.getBoundingClientRect(), isChartAboveList),
  };
}
