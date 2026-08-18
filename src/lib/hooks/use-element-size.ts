import { useEffect, useEffectEvent, useState } from "react";

import type { Size } from "../geometry";
import type { RefObject } from "react";

/**
 * Reports an element's size on mount and on every change. The callback runs from
 * the observer itself, so a caller that only forwards a measurement somewhere else
 * does not have to hold it in state and re-render to pass it on.
 */
export function useElementResize(ref: RefObject<HTMLElement | null>, onResize: (size: Size) => void): void {
  // Always the latest callback, so a caller does not have to keep one stable
  // to avoid tearing the observer down and rebuilding it on every render.
  const report = useEffectEvent(onResize);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      report({ width, height });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);
}

/**
 * Tracks the size of an element. The size is {0, 0} until the element is
 * measured, so a caller that positions against it must handle the first pass.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useElementResize(ref, ({ width, height }) =>
    // Keep the same object when the size did not change, so the
    // value can be an effect dependency without causing a loop.
    setSize((current) => (current.width === width && current.height === height ? current : { width, height })),
  );

  return size;
}
