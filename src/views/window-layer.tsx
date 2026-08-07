import { Suspense, memo, useRef, useState } from "react";

import { Window } from "#/components/window";
import { constrain } from "#/lib/geometry";
import { useElementSize } from "#/lib/hooks/use-element-size";
import { useFocusedWindow, useWindowActions, useWindowOrder, useWindows } from "#/lib/window-manager";

import { DesktopIcons } from "./desktop-icons";
import styles from "./desktop.module.css";
import { WindowBody } from "./window-body";

import type { ReactNode } from "react";

/**
 * The body of a window. It depends on the path alone, so it is held apart from
 * the geometry as a drag rewrites the geometry many times per second.
 */
const WindowContent = memo(function Content({ path }: { path: string }) {
  return (
    <Suspense fallback={null}>
      <WindowBody path={path} />
    </Suspense>
  );
});

/**
 * One open window. Everything it needs arrives as a primitive, and the only context
 * it reads is the actions, whose value never changes. This prevents dragging one
 * from re-rendering all other windows. The layer below re-renders on every pointer
 * frame, but the windows that did not move compare equal here.
 */
const DesktopWindow = memo(function OpenWindow({
  path,
  title,
  x,
  y,
  width,
  height,
  z,
  focused,
  maximized,
  hidden,
}: {
  path: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  focused: boolean;
  maximized: boolean;
  hidden: boolean;
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
      onClose={() => close(path)}
      onZoom={() => toggleZoom(path)}
      onFocus={() => focus(path)}
      onMove={(nextX, nextY) => move(path, nextX, nextY)}
      onResize={(nextWidth, nextHeight) => resize(path, nextWidth, nextHeight)}
    >
      <WindowContent path={path} />
    </Window>
  );
});

/**
 * The surface that hosts the open windows, stacked back to front by `zIndex`.
 * `children` is the router outlet. It shows nothing but keeps the matched route
 * mounted for SSR and head tags.
 */
export function WindowLayer({ children }: { children: ReactNode }) {
  const windows = useWindows();
  const order = useWindowOrder();
  const focusedPath = useFocusedWindow();
  const { focusDesktop } = useWindowActions();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const surfaceSize = useElementSize(surfaceRef);

  /* The visibility of a window opened from an icon is suppressed
   * until the zoom rect has finished growing towards it. */
  const [zoomRectPath, setZoomRectPath] = useState<string | null>(null);

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
      <DesktopIcons onZoomRectPathChange={setZoomRectPath} />
      {/* By route instead of stacking order to avoid reordering nodes in the DOM
       * which affects the scroll position of elements inside the windows.
       *
       * Implications:
       * - The order of the windows is managed by `zIndex`
       * - The tab order follows the markup (focus raises the window it lands in) */}
      {Object.entries(windows)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([path, state]) => {
          const geometry = constrain(state, surfaceSize);

          return (
            <DesktopWindow
              key={path}
              path={path}
              title={state.title}
              {...geometry}
              z={order.indexOf(path) + 1}
              focused={path === focusedPath}
              maximized={state.maximized}
              hidden={path === zoomRectPath}
            />
          );
        })}
      {children}
    </div>
  );
}
