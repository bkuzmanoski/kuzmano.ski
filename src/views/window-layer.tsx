import { Suspense, memo, useRef } from "react";

import { constrain } from "#/lib/geometry";
import { useElementSize } from "#/lib/use-element-size";
import { useFocusedWindow, useWindowActions, useWindowOrder, useWindows } from "#/lib/window-manager";
import { Window } from "#/ui/window";

import { DesktopIcons } from "./desktop-icons";
import styles from "./desktop.module.css";
import { WindowBody } from "./window-body";

import type { ReactNode } from "react";

/**
 * The body of a window. It depends on the path alone, so it is held apart from
 * the geometry: a drag rewrites the geometry many times per second and must not
 * re-render a long post or a list of entries with it.
 */
const WindowContent = memo(function Content({ path }: { path: string }) {
  return (
    <Suspense fallback={null}>
      <WindowBody path={path} />
    </Suspense>
  );
});

/**
 * The surface that hosts open windows, back to front. `children` is the router outlet;
 * it shows nothing but keeps the matched route mounted for SSR and head tags.
 */
export function WindowLayer({ children }: { children: ReactNode }) {
  const windows = useWindows();
  const order = useWindowOrder();
  const focusedPath = useFocusedWindow();
  const { close, focus, move, resize, toggleZoom, focusDesktop } = useWindowActions();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const surfaceSize = useElementSize(surfaceRef);

  return (
    <div
      ref={surfaceRef}
      className={styles.windowLayer}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          focusDesktop();
        }
      }}
    >
      <DesktopIcons />
      {order.map((path, index) => {
        const state = windows[path];

        if (!state) {
          return null;
        }

        const geometry = constrain(state, surfaceSize);

        return (
          <Window
            key={path}
            title={state.title}
            {...geometry}
            z={index + 1}
            focused={path === focusedPath}
            maximized={state.maximized}
            onClose={() => close(path)}
            onFocus={() => focus(path)}
            onMove={(x, y) => move(path, x, y)}
            onZoom={() => toggleZoom(path)}
            onResize={(width, height) => resize(path, width, height)}
          >
            <WindowContent path={path} />
          </Window>
        );
      })}
      {children}
    </div>
  );
}
