import type { Rect } from "#/lib/geometry.ts";

import styles from "./drag-outline.module.css";

/**
 * Outline shown while dragging or resizing a window while the window itself stays put until release.
 *
 * Rendered as a sibling of the windows so it shares their stacking context and sits above them; a drag focuses its
 * window first, so the outline never crosses behind another window.
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
