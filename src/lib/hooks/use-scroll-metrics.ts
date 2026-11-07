import { useCallback, useEffect, useState } from "react";

import { createFrameScheduler } from "../frame-scheduler.ts";

import type { RefObject } from "react";

export interface ScrollMetrics {
  top: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Tracks an element's scrollable height and scroll position. */
export function useScrollMetrics(ref: RefObject<HTMLElement | null>) {
  const [metrics, setMetrics] = useState<ScrollMetrics>({ top: 0, scrollHeight: 0, clientHeight: 0 });

  const measure = useCallback(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    setMetrics((current) =>
      current.top === element.scrollTop &&
      current.scrollHeight === element.scrollHeight &&
      current.clientHeight === element.clientHeight
        ? current
        : { top: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight },
    );
  }, [ref]);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    measure();

    const measurement = createFrameScheduler(measure);
    const resizeObserver = new ResizeObserver(measurement.schedule);

    const observeChildren = () => {
      for (const child of element.children) {
        resizeObserver.observe(child);
      }
    };

    resizeObserver.observe(element);
    observeChildren();

    const mutationObserver = new MutationObserver(() => {
      observeChildren();
      measurement.schedule();
    });

    mutationObserver.observe(element, { childList: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      measurement.stop();
    };
  }, [ref, measure]);

  return { metrics, measure };
}
