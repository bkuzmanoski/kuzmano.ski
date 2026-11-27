import { memo, useCallback, useMemo, useRef, useState } from "react";

import { WINDOW_DOM_ORDER, WINDOW_LAYOUT } from "#/config/desktop.ts";
import { DesktopIcons } from "#/features/desktop-icons/desktop-icons.tsx";
import { rectRelativeTo } from "#/lib/geometry.ts";
import type { Rect, Size } from "#/lib/geometry.ts";
import { useElementResize } from "#/lib/hooks/use-element-size.ts";
import { isPointerClick } from "#/lib/press/press.ts";
import {
  useFocusedWindow,
  useSurface,
  useWindowActions,
  useWindowContent,
  useWindowGeometry,
  useWindowOrder,
} from "#/lib/window-manager/context.ts";
import { createWindowPlacer, createWindowResizer } from "#/lib/window-manager/layout.ts";
import type { WindowClose } from "#/lib/window-manager/use-close-window.ts";
import { WindowCloseContext } from "#/lib/window-manager/use-close-window.ts";
import { ZoomRectContext } from "#/lib/window-manager/use-zoom-rect.ts";
import type { ZoomRectRequest } from "#/lib/window-manager/use-zoom-rect.ts";
import { isUnmeasured } from "#/lib/window-manager/window.ts";
import type { WindowGeometry, WindowId, WindowSizing } from "#/lib/window-manager/window.ts";

import { DragOutline } from "./drag-outline.tsx";
import { WindowBody, WindowHeader } from "./window-body.tsx";
import styles from "./window-layer.module.css";
import { Window } from "./window.tsx";
import { ZoomRect } from "./zoom-rect.tsx";

import type { WindowDrag, WindowSizingControls } from "./window.tsx";
import type { ReactNode } from "react";

const placeWindow = createWindowPlacer(WINDOW_LAYOUT);
const resizeWindow = createWindowResizer(WINDOW_LAYOUT);

interface WindowDragState {
  id: WindowId;
  drag: WindowDrag;
}

function outlineRect(geometry: WindowGeometry, surface: Size, drag: WindowDrag): Rect {
  return drag.kind === "move"
    ? placeWindow({ ...geometry, x: drag.x, y: drag.y }, surface)
    : resizeWindow(geometry, surface, drag);
}

// Memoized because the layer re-renders on every pointer frame while unchanged windows keep equal props.
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
  onDrag,
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
  onDrag: (drag: WindowDragState | null) => void;
}) {
  const { close, registerCloseGuard, focus, move, resize, fitContentHeight, toggleZoom } = useWindowActions();

  // Memoized because the body registers its close guard against this object, so changing its identity would re-register
  // the guard on every render.
  const windowClose = useMemo<WindowClose>(
    () => ({
      forceClose: () => close(id, { force: true }),
      close: () => close(id),
      registerGuard: (guard) => registerCloseGuard(id, guard),
    }),
    [close, id, registerCloseGuard],
  );

  function sizingControlsFor(sizing: WindowSizing): WindowSizingControls {
    switch (sizing) {
      case "resizable":
        return {
          kind: "resizable",
          onZoom: () => toggleZoom(id),
          onResize: (nextWidth, nextHeight) => resize(id, nextWidth, nextHeight),
        };

      case "fitContentHeight":
        return { kind: "fitContentHeight", onFitContentHeight: (nextHeight) => fitContentHeight(id, nextHeight) };

      case "fixed":
        return { kind: "fixed" };
    }
  }

  const sizingControls = sizingControlsFor(WINDOW_LAYOUT.windows[id].sizing);

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
      sizing={sizingControls}
      onClose={windowClose.close}
      onFocus={() => focus(id)}
      onMove={(nextX, nextY) => move(id, nextX, nextY)}
      onDrag={(drag) => onDrag(drag && { id, drag })}
      header={<WindowHeader route={route} />}
    >
      <WindowCloseContext value={windowClose}>
        <WindowBody route={route} />
      </WindowCloseContext>
    </Window>
  );
});

/**
 * Surface hosting open windows stacked back to front by `zIndex`. `children` is the router outlet, rendered without
 * visible output so the matched route stays mounted for SSR and head tags.
 */
export function WindowLayer({ children }: { children: ReactNode }) {
  const surface = useSurface();
  const content = useWindowContent();
  const geometry = useWindowGeometry();
  const order = useWindowOrder();
  const focusedWindow = useFocusedWindow();
  const { focusDesktop, measure } = useWindowActions();

  // Animates from an icon or collection entry to its opened window, which remains hidden until the animation finishes.
  const [zoomRect, setZoomRect] = useState<{ windowId: WindowId; from: Rect } | null>(null);

  // The window being moved or resized, which remains stationary while an outline shows its proposed position. The drag
  // is stored here rather than in the window, so its update on each pointer frame does not re-render every window.
  const [windowDrag, setWindowDrag] = useState<WindowDragState | null>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const isDesktopTouchPendingRef = useRef(false); // A touch on the desktop that focuses it at its `click`.

  useElementResize(surfaceRef, measure);

  // Converts viewport coordinates to the shared surface coordinate space used by windows and the zoom rect. Memoized
  // explicitly because React Compiler cannot guarantee a stable context value identity.
  const showZoomRect = useCallback(
    ({ windowId, from }: ZoomRectRequest) =>
      setZoomRect({
        windowId,
        from: rectRelativeTo(from, surfaceRef.current?.getBoundingClientRect() ?? { x: 0, y: 0 }),
      }),
    [],
  );

  const isUnplaced = isUnmeasured(surface);
  const zoomTarget = zoomRect ? geometry[zoomRect.windowId] : undefined;
  const draggedGeometry = windowDrag ? geometry[windowDrag.id] : undefined;

  return (
    // The main landmark as the desktop and its windows are the page's content.
    <main
      ref={surfaceRef}
      className={styles.windowLayer}
      data-desktop=""
      onPointerDown={(event) => {
        isDesktopTouchPendingRef.current = false;

        if (event.target !== event.currentTarget) {
          return;
        }

        // A touch focuses the desktop at its `click`, as it can begin a gesture that the browser takes over, which
        // dispatches no `click`. Android's back gesture starts as a touch at the edge of the screen, and focusing the
        // desktop there would navigate to it before the gesture navigates back.
        if (event.pointerType === "touch") {
          isDesktopTouchPendingRef.current = true;
        } else {
          focusDesktop();
        }
      }}
      onPointerCancel={() => {
        isDesktopTouchPendingRef.current = false;
      }}
      onClick={(event) => {
        if (isDesktopTouchPendingRef.current && event.target === event.currentTarget && isPointerClick(event)) {
          focusDesktop();
        }

        isDesktopTouchPendingRef.current = false;
      }}
    >
      <ZoomRectContext value={showZoomRect}>
        <DesktopIcons />
        {/* Animates from the icon or collection entry to the new window. The shared stacking context, matching z-index,
          and earlier DOM position keep it below the new window and above existing windows. Both use geometry fitted to
          the same desktop surface so the animation aligns with the window. */}
        {zoomRect && (
          <ZoomRect
            key={zoomRect.windowId}
            from={zoomRect.from}
            target={zoomTarget ? placeWindow(zoomTarget, surface) : null}
            z={order.length}
            onDone={() => setZoomRect(null)}
          />
        )}
        {/* Sort by ID for stable DOM order (preserves scroll positions). `zIndex` manages the stacking order. */}
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
              onDrag={setWindowDrag}
            />
          );
        })}
        {windowDrag && draggedGeometry && (
          <DragOutline
            kind={windowDrag.drag.kind}
            rect={outlineRect(draggedGeometry, surface, windowDrag.drag)}
            z={order.length + 1}
          />
        )}
        {children}
      </ZoomRectContext>
    </main>
  );
}
