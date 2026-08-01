import { useEffect, useEffectEvent, useRef, useState } from "react";

import { ICONS, ICON_IDS, ICON_LAYOUT } from "#/config/icons";
import { downloadFile } from "#/lib/download";
import { constrain } from "#/lib/geometry";
import type { Rect, Size } from "#/lib/geometry";
import type { Icon } from "#/lib/icon";
import { commitIconPositions, moveIcon, nextIconId, useIconPositions } from "#/lib/icon";
import { clamp } from "#/lib/math";
import { playClick } from "#/lib/sound";
import { useElementSize } from "#/lib/use-element-size";
import { useWindowActions, useWindowOrder, useWindows } from "#/lib/window-manager";
import { DesktopIcon } from "#/ui/desktop-icon";

import styles from "./desktop-icons.module.css";

import type { KeyboardEvent } from "react";

const ACTIVATION_FLASH_STEPS_MS = [70, 140, 210]; // Step 1: flash on, Step 2: flash off, Step 3: flash on and end, in ms from the press
const ZOOM_RECT_ANIMATION_MS = 200;
const ZOOM_RECT_HOLD_MS = 260;

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
  path,
  containerSize,
  onDone,
}: {
  from: Rect;
  path: string;
  containerSize: Size;
  onDone: () => void;
}) {
  const windows = useWindows();
  const order = useWindowOrder();
  const [box, setBox] = useState(from);
  const [animate, setAnimate] = useState(false);

  /* The window this grows towards was opened in the same handler that mounted
   * this component, so its geometry is in state by the first render. Latching it
   * here means a later move or resize cannot redirect the animation midway. */
  const [target] = useState(() => {
    const state = windows[path];
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

export function DesktopIcons() {
  const openPaths = useWindowOrder();
  const { open } = useWindowActions();
  const positions = useIconPositions();
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [flashingIconId, setFlashingIconId] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [zooming, setZooming] = useState<{ path: string; from: Rect } | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const containerSize = useElementSize(layerRef);
  const iconsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const flashTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!(event.target as HTMLElement).closest("[data-icon]")) {
        setSelectedIconId(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => () => flashTimersRef.current.forEach(clearTimeout), []);

  function flash(iconId: string) {
    flashTimersRef.current.forEach(clearTimeout);
    setFlashingIconId(iconId);
    setIsFlashing(true);
    flashTimersRef.current = [
      setTimeout(() => setIsFlashing(false), ACTIVATION_FLASH_STEPS_MS[0]),
      setTimeout(() => setIsFlashing(true), ACTIVATION_FLASH_STEPS_MS[1]),
      setTimeout(() => {
        setIsFlashing(false);
        setFlashingIconId(null);
      }, ACTIVATION_FLASH_STEPS_MS[2]),
    ];
  }

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

  function openIcon(iconDefinition: Icon) {
    flash(iconDefinition.id);

    if (iconDefinition.kind === "document") {
      downloadFile(iconDefinition.downloadUrl);
      return;
    }

    const isAlreadyOpen = openPaths.includes(iconDefinition.route);
    const element = iconsRef.current[iconDefinition.id];

    if (element && !isAlreadyOpen) {
      setZooming({ path: iconDefinition.route, from: relativeRect(element) });
    }

    open(iconDefinition.route);
  }

  function focusAdjacentIcon(fromId: string, direction: 1 | -1) {
    const nextId = nextIconId(ICON_IDS, fromId, direction);

    setSelectedIconId(nextId);
    iconsRef.current[nextId]?.focus();
  }

  function onIconKeyDown(event: KeyboardEvent, iconDefinition: Icon) {
    // TODO: The arrow keys should move the selection in the direction of the arrow, not just the next icon in the list.
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        focusAdjacentIcon(iconDefinition.id, 1);

        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        focusAdjacentIcon(iconDefinition.id, -1);

        break;
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

  const tabStop = selectedIconId ?? ICONS[0]?.id;
  const containerWidth = containerSize.width || (typeof window === "undefined" ? 0 : window.innerWidth);
  const containerHeight = containerSize.height || (typeof window === "undefined" ? 0 : window.innerHeight);

  return (
    <>
      {/*
       * The layer always renders so its ref exists for measurement. `positions`
       * is null until the client has read them, which keeps the icons out of the
       * server render: a position means nothing before the layer is measured.
       */}
      <div ref={layerRef} className={styles.layer}>
        {positions &&
          ICONS.map((iconDefinition) => {
            const position = positions[iconDefinition.id];

            if (!position) {
              return null;
            }

            const top = clamp(position.top, 0, Math.max(0, containerHeight - ICON_LAYOUT.cellSize));
            const left = clamp(
              containerWidth - position.right - ICON_LAYOUT.cellSize,
              0,
              Math.max(0, containerWidth - ICON_LAYOUT.cellSize),
            );
            const isSelected = flashingIconId === iconDefinition.id ? isFlashing : selectedIconId === iconDefinition.id;

            return (
              <DesktopIcon
                key={iconDefinition.id}
                ref={(element) => {
                  iconsRef.current[iconDefinition.id] = element;
                }}
                iconDefinition={iconDefinition}
                x={left}
                y={top}
                tabIndex={tabStop === iconDefinition.id ? 0 : -1}
                open={iconDefinition.kind === "folder" && openPaths.includes(iconDefinition.route)}
                selected={isSelected}
                onSelect={() => setSelectedIconId(iconDefinition.id)}
                onOpen={() => openIcon(iconDefinition)}
                onMoveStart={(x, y) =>
                  moveIcon(iconDefinition.id, { right: containerWidth - x - ICON_LAYOUT.cellSize, top: y })
                }
                onMoveEnd={commitIconPositions}
                onKeyDown={(event) => onIconKeyDown(event, iconDefinition)}
              />
            );
          })}
      </div>

      {zooming && (
        <ZoomRect
          from={zooming.from}
          path={zooming.path}
          containerSize={containerSize}
          onDone={() => setZooming(null)}
        />
      )}
    </>
  );
}
