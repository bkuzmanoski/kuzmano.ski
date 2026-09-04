import type { Rect } from "#/lib/geometry.ts";

import styles from "./drag-outline.module.css";

/**
 * The outline a window is dragged and resized by, while the window itself stays where it is until the
 * gesture ends.
 *
 * It is a sibling of the windows so it shares their stacking context, and is stacked above all of
 * them: a drag starts by focusing its window, so the outline never crosses a window in front.
 */
export function DragOutline({ kind, rect, z }: { kind: "move" | "resize"; rect: Rect; z: number }) {
  return (
    <div
      className={styles.dragOutline}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, zIndex: z }}
    >
      {kind === "resize" && (
        <>
          <div className={styles.titleBarBorder} />
          <div className={styles.scrollbarBorder} />
          <div className={styles.resizeControlBorder} />
        </>
      )}
    </div>
  );
}
