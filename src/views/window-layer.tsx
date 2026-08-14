import { memo, useEffect, useRef, useState } from "react";

import { Window } from "#/components/window";
import { LAYOUT } from "#/config/windows";
import type { Rect } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";
import {
  WINDOW_DOM_ORDER,
  createWindowPlacer,
  isUnmeasured,
  useFocusedWindow,
  useSurface,
  useWindowActions,
  useWindowContent,
  useWindowGeometry,
  useWindowOrder,
} from "#/lib/window-manager";
import type { WindowId } from "#/lib/window-manager";

import { DesktopIcons } from "./desktop-icons";
import { WindowBody } from "./window-body";
import styles from "./window-layer.module.css";
import { ZoomRect } from "./zoom-rect";

import type { ReactNode } from "react";

const placeWindow = createWindowPlacer(LAYOUT);

/* The layer below re-renders on every pointer frame, but the windows that did
 * not move compare equal here (the values `useWindowActions` do not change). */
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
      contentKey={route}
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
  const surface = useSurface();
  const content = useWindowContent();
  const geometry = useWindowGeometry();
  const order = useWindowOrder();
  const focusedWindow = useFocusedWindow();
  const { focusDesktop, measure } = useWindowActions();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const measuredSurface = useElementSize(surfaceRef);

  const isUnplaced = isUnmeasured(surface);

  /* The zoom-rect growing from an icon towards the window it opened. While it runs,
   * the visibility of that window is suppressed until the outline has landed on it. */
  const [zoomRect, setZoomRect] = useState<{ windowId: WindowId; from: Rect } | null>(null);
  const zoomTarget = zoomRect ? geometry[zoomRect.windowId] : undefined;

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
      <DesktopIcons onZoomRect={setZoomRect} />
      {zoomRect && (
        <ZoomRect
          key={zoomRect.windowId}
          from={zoomRect.from}
          target={zoomTarget ? placeWindow(zoomTarget, surface) : null}
          z={order.length}
          onDone={() => setZoomRect(null)}
        />
      )}
      {/* By window id instead of stacking order to avoid reordering nodes in the DOM
       * which affects the scroll position of elements inside the windows.
       *
       * Implications:
       * - The order of the windows is managed by `zIndex`
       * - The tab order follows the markup (focus raises the window it lands in) */}
      {WINDOW_DOM_ORDER.map((id) => {
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
            {...placeWindow(windowGeometry, surface)}
            z={order.indexOf(id) + 1}
            focused={id === focusedWindow}
            maximized={windowGeometry.maximized}
            hidden={id === zoomRect?.windowId}
            unplaced={isUnplaced}
          />
        );
      })}
      {children}
    </div>
  );
}
