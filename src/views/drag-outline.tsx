import type { Rect } from "#/lib/geometry";

import styles from "./drag-outline.module.css";

/**
 * The outline a window is dragged and resized by while the window itself stays where it is
 * until the gesture ends.
 *
 * A move shows the shape of the window alone. A resize also shows the borders that divide
 * its chrome, which is how the size being chosen is read: the title bar keeps its height
 * while the pane below it grows, and the scrollbar keeps its width. Both are drawn
 * unconditionally because a resizable window always shows them. The resize control lives in
 * the scrollbar, which is why the scrollbar cannot collapse while one is present (see
 * `/src/components/scrollbar.tsx`), and a maximized window offers no resize control at all.
 *
 * It is a sibling of the windows so it shares their stacking context, and sits above all of
 * them: a drag starts by activating its window, so the outline never crosses one in front.
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
