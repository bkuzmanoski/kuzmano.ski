import { useEffect, useState } from "react";

import type { Size } from "../geometry";
import type { RefObject } from "react";

/**
 * Tracks the size of an element. The size is {0, 0} until the element is
 * measured, so a caller that positions against it must handle the first pass.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    /* Keep the same object when the size did not change, so the
     * value can be an effect dependency without causing a loop. */
    const measure = () =>
      setSize((current) => {
        const { width, height } = element.getBoundingClientRect();
        return current.width === width && current.height === height ? current : { width, height };
      });

    measure();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}
