import { useEffect, useEffectEvent, useState } from "react";

import type { Rect } from "#/lib/geometry";

import styles from "./zoom-rect.module.css";

const ZOOM_RECT_ANIMATION_MS = 200;
const ZOOM_RECT_HOLD_MS = 260;

/**
 * The zoom-rect that grows from an icon to the window it opened. It is a sibling
 * of the windows, not part of the icon layer, so it shares their stacking context.
 * Its z-index sits at the new window's level; being earlier in the DOM, it draws
 * below that window but above every other window.
 *
 * The target box comes from the window state, fitted to the same desktop rect the
 * window layer uses, so the outline lands exactly on the window.
 */
export function ZoomRect({
  from,
  target,
  z,
  onDone,
}: {
  from: Rect;
  target: Rect | null;
  z: number;
  onDone: () => void;
}) {
  const [box, setBox] = useState(from);
  const [animate, setAnimate] = useState(false);

  /* The window the zoom rect grows towards was opened in the same handler that mounted
   * this component, so its geometry is in state by the first render. */
  const [latchedTarget] = useState(target);

  const start = useEffectEvent(() => {
    const frames: Array<number> = [];

    if (latchedTarget) {
      // Two frames: the outline must paint at the icon before it starts to grow.
      frames.push(
        requestAnimationFrame(() =>
          frames.push(
            requestAnimationFrame(() => {
              setBox(latchedTarget);
              setAnimate(true);
            }),
          ),
        ),
      );
    }

    return frames;
  });

  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const timer = setTimeout(finish, ZOOM_RECT_HOLD_MS);
    const frames = start();

    return () => {
      clearTimeout(timer);
      frames.forEach(cancelAnimationFrame);
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
        transition: animate ? `all ${ZOOM_RECT_ANIMATION_MS}ms ease-out` : "none",
      }}
    />
  );
}
