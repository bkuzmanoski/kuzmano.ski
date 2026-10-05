import { useEffect } from "react";

import type { CareerTimelineListState } from "./use-career-timeline-minimap.ts";
import type { RefObject } from "react";

export interface CareerTimelineLastRoleHeightElements {
  careerTimeline: RefObject<HTMLElement | null>;
  list: RefObject<HTMLOListElement | null>;
}

const LAST_ROLE_HEIGHT_PROPERTY = "--career-timeline-last-role-height";

/**
 * Sets `--career-timeline-last-role-height` on the career timeline to the height of the last role in the
 * list, so that where the rail is collapsed, the sticky chart column begins scrolling out of view along
 * with the last role (see `career-timeline.module.css`). The property is removed while no role is listed.
 *
 * The last role is measured when it resizes, and again when `listState` changes, which reorders or filters
 * the roles and so can make another role the last.
 */
export function useCareerTimelineLastRoleHeight(
  { careerTimeline, list }: CareerTimelineLastRoleHeightElements,
  { direction, hiddenDisciplineIds }: CareerTimelineListState,
) {
  useEffect(() => {
    const careerTimelineElement = careerTimeline.current;
    const lastRoleElement = list.current?.lastElementChild;

    if (!careerTimelineElement || !lastRoleElement) {
      return;
    }

    const measureLastRoleHeight = () => {
      const lastRoleHeight = `${lastRoleElement.getBoundingClientRect().height}px`;

      // Skip the write if the height is unchanged.
      if (careerTimelineElement.style.getPropertyValue(LAST_ROLE_HEIGHT_PROPERTY) !== lastRoleHeight) {
        careerTimelineElement.style.setProperty(LAST_ROLE_HEIGHT_PROPERTY, lastRoleHeight);
      }
    };

    measureLastRoleHeight();

    const resizeObserver = new ResizeObserver(measureLastRoleHeight);

    resizeObserver.observe(lastRoleElement);

    return () => {
      resizeObserver.disconnect();
      careerTimelineElement.style.removeProperty(LAST_ROLE_HEIGHT_PROPERTY);
    };

    // The list state is not read here, but a change to it can make another role the last.
  }, [careerTimeline, list, direction, hiddenDisciplineIds]);
}
