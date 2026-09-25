import { useRef } from "react";

import { Scrollbar } from "#/components/scrollbar.tsx";
import { playPaneScroll, silenceScrollIntoView } from "#/lib/audio/scroll.ts";
import { useScrollMetrics } from "#/lib/hooks/use-scroll-metrics.ts";
import { mergeRefs } from "#/lib/merge-refs.ts";

import styles from "./scroll-pane.module.css";

import type { ReactNode, Ref } from "react";

/** Matches a pane's scrolling viewport, so content inside the pane can find it with `closest`. */
export const SCROLL_PANE_VIEWPORT_SELECTOR = "[data-scroll-pane-viewport]";

/**
 * A scrolling viewport paired with the window's own scrollbar.
 *
 * The pane reads its layout from the `--window-safe-area-*` properties the window sets, so it extends
 * into the safe-area insets with the window that contains it.
 */
export function ScrollPane({
  id,
  viewportRef,
  resizeControl,
  children,
}: {
  id: string;
  viewportRef?: Ref<HTMLDivElement>; // Attached to the scrolling viewport, rather than the pane that also contains the scrollbar.
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
        ref={mergeRefs(viewportRef, contentContainerRef)}
        id={id}
        tabIndex={-1}
        className={styles.contentContainer}
        data-scroll-pane-viewport
        data-overscrolled={overscrolledEnd}
        onFocus={(event) => silenceScrollIntoView(event.target)}
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
