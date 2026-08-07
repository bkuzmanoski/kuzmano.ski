import { memo, useEffect, useRef, useState } from "react";

import { Window } from "#/components/window";
import { constrain } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";
import {
  useFocusedWindow,
  useSurface,
  useWindowActions,
  useWindowContent,
  useWindowGeometry,
  useWindowOrder,
} from "#/lib/window-manager";
import { WINDOW_IDS, hasSidebar } from "#/lib/window-registry";
import type { WindowId } from "#/lib/window-registry";

import { DesktopIcons } from "./desktop-icons";
import styles from "./desktop.module.css";
import { WindowBody, WindowSidebar } from "./window-body";

import type { ReactNode } from "react";

/**
 * One open window. Everything it needs arrives as a primitive, and the only context
 * it reads is the actions, whose value never changes. This prevents dragging one
 * from re-rendering all other windows. The layer below re-renders on every pointer
 * frame, but the windows that did not move compare equal here.
 */
const DesktopWindow = memo(function OpenWindow({
  id,
  route,
  title,
  x,
  y,
  width,
  height,
  z,
  focused,
  maximized,
  hidden,
  unplaced,
}: {
  id: WindowId;
  route: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  focused: boolean;
  maximized: boolean;
  hidden: boolean;
  unplaced: boolean;
}) {
  const { close, focus, move, resize, toggleZoom } = useWindowActions();

  return (
    <Window
      title={title}
      x={x}
      y={y}
      width={width}
      height={height}
      z={z}
      focused={focused}
      maximized={maximized}
      hidden={hidden}
      unplaced={unplaced}
      sidebar={hasSidebar(id) && <WindowSidebar route={route} />}
      onClose={() => close(id)}
      onZoom={() => toggleZoom(id)}
      onFocus={() => focus(id)}
      onMove={(nextX, nextY) => move(id, nextX, nextY)}
      onResize={(nextWidth, nextHeight) => resize(id, nextWidth, nextHeight)}
    >
      <WindowBody route={route} />
    </Window>
  );
});

/**
 * The surface that hosts the open windows, stacked back to front by `zIndex`.
 * `children` is the router outlet. It shows nothing but keeps the matched route
 * mounted for SSR and head tags.
 */
export function WindowLayer({ children }: { children: ReactNode }) {
  const content = useWindowContent();
  const geometry = useWindowGeometry();
  const order = useWindowOrder();
  const focusedWindow = useFocusedWindow();
  const { focusDesktop, measure } = useWindowActions();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const measuredSurface = useElementSize(surfaceRef);

  /* The windows are placed using the size in the manager state, not the one just measured
   * so that a window and the desktop its position was computed from can never disagree.
   * CSS centres them to match where the manager will place them when they are measured. */
  const surface = useSurface();
  const isUnplaced = surface.width === 0 || surface.height === 0;

  /* The visibility of a window opened from an icon is suppressed
   * until the zoom rect has finished growing towards it. */
  const [zoomRectWindow, setZoomRectWindow] = useState<WindowId | null>(null);

  useEffect(() => {
    measure(measuredSurface);
  }, [measure, measuredSurface]);

  return (
    <div
      ref={surfaceRef}
      className={styles.windowLayer}
      data-desktop=""
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          focusDesktop();
        }
      }}
    >
      <DesktopIcons onZoomRectWindowChange={setZoomRectWindow} />
      {/* By window id instead of stacking order to avoid reordering nodes in the DOM
       * which affects the scroll position of elements inside the windows.
       *
       * Implications:
       * - The order of the windows is managed by `zIndex`
       * - The tab order follows the markup (focus raises the window it lands in) */}
      {WINDOW_IDS.map((id) => {
        const windowContent = content[id];
        const windowGeometry = geometry[id];

        if (!windowContent || !windowGeometry) {
          return null;
        }

        return (
          <DesktopWindow
            key={id}
            id={id}
            route={windowContent.route}
            title={windowContent.title}
            {...constrain(windowGeometry, surface)}
            z={order.indexOf(id) + 1}
            focused={id === focusedWindow}
            maximized={windowGeometry.maximized}
            hidden={id === zoomRectWindow}
            unplaced={isUnplaced}
          />
        );
      })}
      {children}
    </div>
  );
}
