import clsx from "clsx";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { DesktopIcon } from "#/components/desktop-icon";
import { ICONS, ICON_LAYOUT } from "#/config/desktop-icons";
import { playClick } from "#/lib/audio/ui";
import { downloadFile } from "#/lib/download";
import { constrain } from "#/lib/geometry";
import type { Position, Rect, Size } from "#/lib/geometry";
import { useActivationFlash } from "#/lib/hooks/use-activation-flash";
import { useElementSize } from "#/lib/hooks/use-element-size";
import { useIsBootSequenceComplete } from "#/lib/hooks/use-is-boot-sequence-complete";
import type { Icon } from "#/lib/icon";
import { commitIconPositions, moveIcon, useIconPositions } from "#/lib/icon-positions";
import { clamp } from "#/lib/math";
import {
  useFocusedWindow,
  useWindowActions,
  useWindowContent,
  useWindowGeometry,
  useWindowOrder,
} from "#/lib/window-manager";
import { desktopRouteOf, resolveWindow } from "#/lib/window-registry";
import type { WindowId } from "#/lib/window-registry";

import styles from "./desktop-icons.module.css";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;

type ArrowKey = (typeof ARROW_KEYS)[number];

const OFF_AXIS_DISTANCE_WEIGHT = 2; //  How much further an icon off the arrow's axis has to be before it loses to one on it during keyboard navigation.
const ZOOM_RECT_ANIMATION_MS = 200;
const ZOOM_RECT_HOLD_MS = 260;

export interface IconPlacement extends Position {
  id: string;
}

const isArrowKey = (key: string): key is ArrowKey => ARROW_KEYS.includes(key as ArrowKey);

/**
 * The icon an arrow key selects, or null when nothing lies the given direction.
 * Candidates are the icons in the half-plane the arrow points at. Distance off
 * the arrow's axis is weighted over distance along it.
 *
 * Exported for unit tests.
 */
export function adjacentIconId(placements: ReadonlyArray<IconPlacement>, fromId: string, key: ArrowKey): string | null {
  const from = placements.find((placement) => placement.id === fromId);

  if (!from) {
    return null;
  }

  const isVertical = key === "ArrowUp" || key === "ArrowDown";
  const sign = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;

  let bestId: string | null = null;
  let bestScore = Infinity;

  for (const placement of placements) {
    if (placement.id === fromId) {
      continue;
    }

    const alongAxisDistance = sign * (isVertical ? placement.y - from.y : placement.x - from.x);
    const offAxisDistance = Math.abs(isVertical ? placement.x - from.x : placement.y - from.y);
    const score = alongAxisDistance + offAxisDistance * OFF_AXIS_DISTANCE_WEIGHT;

    if (alongAxisDistance > 0 && score < bestScore) {
      bestId = placement.id;
      bestScore = score;
    }
  }

  return bestId;
}

/**
 * The zoom-rect that grows from an icon to the window it opened. It is a sibling
 * of the windows, not part of the icon layer, so it shares their stacking context.
 * Its z-index sits at the new window's level; being earlier in the DOM, it draws
 * below that window but above every other window.
 *
 * The target box comes from the window state, fitted to the same container the
 * window layer uses, so the outline lands exactly on the window.
 */
function ZoomRect({
  from,
  windowId,
  containerSize,
  onDone,
}: {
  from: Rect;
  windowId: WindowId;
  containerSize: Size;
  onDone: () => void;
}) {
  const geometry = useWindowGeometry();
  const order = useWindowOrder();
  const [box, setBox] = useState(from);
  const [animate, setAnimate] = useState(false);

  /* The window the zoom rect grows towards was opened in the same handler that mounted
   * this component, so its geometry is in state by the first render. Latching it here
   * means a later move or resize cannot redirect the animation midway. */
  const [target] = useState(() => {
    const state = geometry[windowId];
    return state ? constrain(state, containerSize) : null;
  });

  const start = useEffectEvent(() => {
    const frames: Array<number> = [];

    if (target) {
      // Two frames: the outline must paint at the icon before it starts to grow.
      frames.push(
        requestAnimationFrame(() =>
          frames.push(
            requestAnimationFrame(() => {
              setBox(target);
              setAnimate(true);
            }),
          ),
        ),
      );
    }

    return frames;
  });

  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const timer = setTimeout(finish, ZOOM_RECT_HOLD_MS);
    const frames = start();

    return () => {
      clearTimeout(timer);
      frames.forEach(cancelAnimationFrame);
    };
  }, []);

  return (
    <div
      className={styles.zoomRect}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        zIndex: order.length,
        transition: animate ? `all ${ZOOM_RECT_ANIMATION_MS}ms ease-out` : "none",
      }}
    />
  );
}

export function DesktopIcons({ onZoomRectWindowChange }: { onZoomRectWindowChange: (id: WindowId | null) => void }) {
  const content = useWindowContent();
  const focusedWindow = useFocusedWindow();
  const { open, focusDesktop } = useWindowActions();
  const positions = useIconPositions();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const flash = useActivationFlash<string>();
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [zooming, setZooming] = useState<{ windowId: WindowId; from: Rect } | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const containerSize = useElementSize(layerRef);
  const iconsRef = useRef<Record<string, HTMLDivElement | null>>({});

  /* Only a press on the empty desktop clears the selection. A press on a window or on the
   * menu bar leaves it standing. The desktop stops drawing a selection when it does not hold
   * keyboard focus. */
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof HTMLElement && event.target.dataset.desktop !== undefined) {
        setSelectedIconId(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  /** The box of an element in the layer's own coordinates. */
  function relativeRect(element: Element): Rect {
    const layer = layerRef.current?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();

    return {
      x: rect.left - (layer?.left ?? 0),
      y: rect.top - (layer?.top ?? 0),
      width: rect.width,
      height: rect.height,
    };
  }

  const tabStop = selectedIconId ?? ICONS[0]?.id;
  const openRoutes = new Set(Object.values(content).map(({ route }) => desktopRouteOf(route)));
  const containerWidth = containerSize.width || (typeof window === "undefined" ? 0 : window.innerWidth);
  const containerHeight = containerSize.height || (typeof window === "undefined" ? 0 : window.innerHeight);

  /* Nothing is placed until `positions` has been read on the client which keeps the icons out of the server render. */
  const placements: Array<IconPlacement & { iconDefinition: Icon }> = ICONS.flatMap((iconDefinition) => {
    const position = positions?.[iconDefinition.id];

    if (!position) {
      return [];
    }

    return [
      {
        id: iconDefinition.id,
        iconDefinition,
        x: clamp(
          containerWidth - position.right - ICON_LAYOUT.cellSize,
          0,
          Math.max(0, containerWidth - ICON_LAYOUT.cellSize),
        ),
        y: clamp(position.top, 0, Math.max(0, containerHeight - ICON_LAYOUT.cellSize)),
      },
    ];
  });

  function selectIcon(id: string) {
    setSelectedIconId(id);
    focusDesktop(); // Activate the desktop so the selection is drawn and the arrow keys move it.
    iconsRef.current[id]?.focus();
  }

  function openIcon(iconDefinition: Icon) {
    flash.start(iconDefinition.id);

    if (iconDefinition.kind === "download") {
      downloadFile(iconDefinition.downloadUrl);
      return;
    }

    /* The zoom rect grows towards a window that is not on the desktop yet.
     * A window that is already open only changes what it shows. */
    const windowId = resolveWindow(iconDefinition.route)?.id;
    const element = iconsRef.current[iconDefinition.id];

    if (element && windowId && !content[windowId]) {
      setZooming({ windowId, from: relativeRect(element) });
      onZoomRectWindowChange(windowId);
    }

    open(iconDefinition.route);
  }

  function moveSelection(fromId: string | null, key: ArrowKey) {
    const nextId = fromId === null ? placements[0]?.id : adjacentIconId(placements, fromId, key);

    if (nextId) {
      selectIcon(nextId);
    }
  }

  function onIconKeyDown(event: ReactKeyboardEvent, iconDefinition: Icon) {
    if (isArrowKey(event.key)) {
      event.preventDefault();
      moveSelection(iconDefinition.id, event.key);

      return;
    }

    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        playClick();
        openIcon(iconDefinition);

        break;
      default:
        if (event.altKey && event.code === "KeyO") {
          event.preventDefault();
          playClick();
          openIcon(iconDefinition);
        }
    }
  }

  const onDesktopArrowKeyPress = useEffectEvent((key: ArrowKey) => moveSelection(selectedIconId, key));

  useEffect(() => {
    if (focusedWindow !== null || !isBootSequenceComplete) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target !== document.body) {
        return;
      }

      if (isArrowKey(event.key)) {
        event.preventDefault();
        onDesktopArrowKeyPress(event.key);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedWindow, isBootSequenceComplete]);

  return (
    <>
      {/* The layer always renders so its ref exists for measurement. */}
      <div ref={layerRef} className={clsx(styles.layer, isBootSequenceComplete && styles.ready)}>
        {placements.map(({ id, iconDefinition, x, y }) => (
          <DesktopIcon
            key={id}
            ref={(element) => {
              iconsRef.current[id] = element;
            }}
            iconDefinition={iconDefinition}
            x={x}
            y={y}
            cellSize={ICON_LAYOUT.cellSize}
            tabIndex={tabStop === id ? 0 : -1}
            open={iconDefinition.kind === "collection" && openRoutes.has(iconDefinition.route)}
            selected={flash.isHighlighted(id, focusedWindow === null && selectedIconId === id)}
            onSelect={() => selectIcon(id)}
            onOpen={() => openIcon(iconDefinition)}
            onMoveStart={(nextX, nextY) =>
              moveIcon(id, { right: containerWidth - nextX - ICON_LAYOUT.cellSize, top: nextY })
            }
            onMoveEnd={commitIconPositions}
            onKeyDown={(event) => onIconKeyDown(event, iconDefinition)}
          />
        ))}
      </div>

      {zooming && (
        <ZoomRect
          key={zooming.windowId}
          from={zooming.from}
          windowId={zooming.windowId}
          containerSize={containerSize}
          onDone={() => {
            setZooming(null);
            onZoomRectWindowChange(null);
          }}
        />
      )}
    </>
  );
}
