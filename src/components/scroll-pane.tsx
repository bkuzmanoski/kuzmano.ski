import { useRef } from "react";

import { playPaneScroll, skipScrollAbove } from "#/lib/audio/scroll";
import { useScrollMetrics } from "#/lib/hooks/use-scroll-metrics";

import styles from "./scroll-pane.module.css";
import { Scrollbar } from "./scrollbar";

import type { ReactNode } from "react";

/**
 * A scrolling viewport paired with the window's own scrollbar.
 *
 * The pane reads its layout from the `--window-safe-area-*` properties the window sets,
 * so it extends into the safe-area insets with the window that holds it.
 */
export function ScrollPane({
  id,
  resizeControl,
  children,
}: {
  id: string;
  resizeControl?: ReactNode;
  children: ReactNode;
}) {
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const { metrics, measure } = useScrollMetrics(contentContainerRef);

  const overscrolledEnd =
    metrics.top < -1 ? "start" : metrics.top + metrics.clientHeight > metrics.scrollHeight + 1 ? "end" : undefined; // A pixel of slack keeps a rounded height from reading as an overscroll at rest.

  return (
    <div className={styles.scrollPane}>
      <div
        ref={contentContainerRef}
        className={styles.contentContainer}
        data-overscrolled={overscrolledEnd}
        id={id}
        tabIndex={-1}
        onFocus={(event) => skipScrollAbove(event.target)}
        onScroll={(event) => {
          measure();
          playPaneScroll(event.currentTarget);
        }}
      >
        {children}
      </div>
      <Scrollbar
        viewportRef={contentContainerRef}
        viewportId={id}
        metrics={metrics}
        className={styles.scrollbar}
        resizeControl={resizeControl}
      />
    </div>
  );
}
