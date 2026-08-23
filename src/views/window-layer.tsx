import { memo, useMemo, useRef, useState } from "react";

import { Window } from "#/components/window";
import type { WindowDrag } from "#/components/window";
import { LAYOUT } from "#/config/windows";
import type { Rect, Size } from "#/lib/geometry";
import { WindowCloseContext } from "#/lib/hooks/use-close-window";
import type { WindowClose } from "#/lib/hooks/use-close-window";
import { useElementResize } from "#/lib/hooks/use-element-size";
import {
  WINDOW_DOM_ORDER,
  createWindowPlacer,
  createWindowResizer,
  isUnmeasured,
  useFocusedWindow,
  useSurface,
  useWindowActions,
  useWindowContent,
  useWindowGeometry,
  useWindowOrder,
} from "#/lib/window-manager";
import type { WindowGeometry, WindowId } from "#/lib/window-manager";

import { DesktopIcons } from "./desktop-icons";
import { DragOutline } from "./drag-outline";
import { WindowBody } from "./window-body";
import styles from "./window-layer.module.css";
import { WindowToolbar } from "./window-toolbar";
import { ZoomRect } from "./zoom-rect";

import type { ReactNode } from "react";

const placeWindow = createWindowPlacer(LAYOUT);
const resizeWindow = createWindowResizer(LAYOUT);

/** A drag reported by one of the open windows, which the outline standing in for it is built from. */
interface WindowDragState {
  id: WindowId;
  drag: WindowDrag;
}

/**
 * Where the outline for a drag stands. The proposal the window reports is fitted to the desktop
 * by the same rules the manager will apply when the gesture ends, so the window lands exactly
 * where the outline was left rather than jumping on release.
 */
function outlineRect(geometry: WindowGeometry, surface: Size, drag: WindowDrag): Rect {
  return drag.kind === "move"
    ? placeWindow({ ...geometry, x: drag.x, y: drag.y }, surface)
    : resizeWindow(geometry, surface, drag);
}

// The layer below re-renders on every pointer frame, but the windows that did
// not move compare equal here (the values `useWindowActions` do not change).
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
  const { close, registerCloseGuard, focus, move, resize, toggleZoom } = useWindowActions();

  // The close API for this window, passed to its body. Memoized because the body registers
  // its close guard against this object, so changing its identity would re-register the guard.
  const windowClose = useMemo<WindowClose>(
    () => ({
      forceClose: () => close(id, { force: true }),
      close: () => close(id),
      registerGuard: (guard) => registerCloseGuard(id, guard),
    }),
    [close, id, registerCloseGuard],
  );

  const { fixedSize } = LAYOUT.windows[id];

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
      onClose={windowClose.close}
      onZoom={fixedSize ? null : () => toggleZoom(id)}
      onFocus={() => focus(id)}
      onMove={(nextX, nextY) => move(id, nextX, nextY)}
      onResize={fixedSize ? null : (nextWidth, nextHeight) => resize(id, nextWidth, nextHeight)}
      onDrag={(drag) => onDrag(drag && { id, drag })}
      toolbar={<WindowToolbar route={route} />}
    >
      <WindowCloseContext value={windowClose}>
        <WindowBody route={route} />
      </WindowCloseContext>
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

  // The surface size lives in the window state, so it is reported straight there
  // rather than being held here and forwarded by an effect a render later.
  useElementResize(surfaceRef, measure);

  const isUnplaced = isUnmeasured(surface);

  // The zoom-rect growing from an icon towards the window it opened. While it runs,
  // the visibility of that window is suppressed until the outline has landed on it.
  const [zoomRect, setZoomRect] = useState<{ windowId: WindowId; from: Rect } | null>(null);
  const zoomTarget = zoomRect ? geometry[zoomRect.windowId] : undefined;

  // The window being moved or resized, which stands still while an outline shows where it is
  // headed. Holding the drag here rather than in the window keeps every window out of the
  // re-render it causes: the layer rebuilds each frame, but the windows compare equal.
  const [windowDrag, setWindowDrag] = useState<WindowDragState | null>(null);
  const draggedGeometry = windowDrag ? geometry[windowDrag.id] : undefined;

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
      {/* Sort by id for stable DOM order (preserves scroll positions). `zIndex` manages the stacking order. */}
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
    </div>
  );
}
