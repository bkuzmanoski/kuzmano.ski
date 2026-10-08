import { useEffect, useEffectEvent, useState } from "react";

import type { Rect } from "#/lib/geometry.ts";

import styles from "./zoom-rect.module.css";

const ZOOM_RECT_TRANSITION_DURATION_MS = 200;

export const ZOOM_RECT_DURATION_MS = 260; // From mounting to calling `onDone`, which includes the transition and a hold at the target.

/**
 * A dashed outline that grows from `from` to `target` in its containing block's
 * coordinates, then calls `onDone` after holding at the target. The target is read
 * only on the first render, so each new zoom rect must be rendered with a new `key`.
 */
export function ZoomRect({
  from,
  target,
  z,
  onDone,
}: {
  from: Rect;
  target: Rect | null;
  z?: number;
  onDone: () => void;
}) {
  const [box, setBox] = useState(from);
  const [animate, setAnimate] = useState(false);
  const [latchedTarget] = useState(target);

  const start = useEffectEvent(() => {
    const frameIds: Array<number> = [];

    if (latchedTarget) {
      // Two frames: the outline must paint at `from` before it starts to grow.
      frameIds.push(
        requestAnimationFrame(() =>
          frameIds.push(
            requestAnimationFrame(() => {
              setBox(latchedTarget);
              setAnimate(true);
            }),
          ),
        ),
      );
    }

    return frameIds;
  });

  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const timer = setTimeout(finish, ZOOM_RECT_DURATION_MS);
    const frameIds = start();

    return () => {
      clearTimeout(timer);
      frameIds.forEach(cancelAnimationFrame);
    };
  }, []);

  return (
    <div
      className={styles.zoomRect}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        zIndex: z,
        transition: animate ? `all ${ZOOM_RECT_TRANSITION_DURATION_MS}ms ease-out` : "none",
      }}
    />
  );
}
