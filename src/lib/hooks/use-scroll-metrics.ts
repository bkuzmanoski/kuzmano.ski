import { useCallback, useEffect, useState } from "react";

import { useElementSize } from "./use-element-size";

import type { RefObject } from "react";

export interface ScrollMetrics {
  top: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Tracks an element's scrollable height and scroll position. */
export function useScrollMetrics(ref: RefObject<HTMLElement | null>) {
  const [metrics, setMetrics] = useState<ScrollMetrics>({ top: 0, scrollHeight: 0, clientHeight: 0 });
  const size = useElementSize(ref);

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
    measure();
  }, [size, measure]);

  useEffect(() => {
    const element = ref.current;

    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    let frame: number | null = null;

    const schedule = () => {
      frame ??= requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };

    const resizeObserver = new ResizeObserver(schedule);

    const observeChildren = () => {
      for (const child of element.children) {
        resizeObserver.observe(child);
      }
    };

    observeChildren();

    let mutationObserver: MutationObserver | undefined;

    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(() => {
        observeChildren();
        schedule();
      });
      mutationObserver.observe(element, { childList: true });
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver?.disconnect();

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [ref, measure]);

  return { metrics, measure };
}
