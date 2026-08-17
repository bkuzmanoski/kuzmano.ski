import { useEffect, useEffectEvent, useRef, useState } from "react";

import { DesktopIcon } from "#/components/desktop-icon";
import { ICONS, ICON_IDS, ICON_LAYOUT, commitIconPositions, moveIcon, useIconPositions } from "#/config/desktop-icons";
import { destinationRouteOf, resolveWindow } from "#/content/window-registry";
import { playClick } from "#/lib/audio/ui";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/use-is-boot-sequence-complete";
import { cx } from "#/lib/class-names";
import { downloadFile } from "#/lib/download";
import type { Rect } from "#/lib/geometry";
import { useActivationFlash } from "#/lib/hooks/use-activation-flash";
import { useElementSize } from "#/lib/hooks/use-element-size";
import type { Icon, IconPlacement } from "#/lib/icons/icon";
import { positionFromDrop, resolveIconPlacements } from "#/lib/icons/layout";
import { adjacentIconId } from "#/lib/icons/navigation";
import { isArrowKey } from "#/lib/keys";
import type { ArrowKey } from "#/lib/keys";
import { useFocusedWindow, useWindowActions, useWindowContent } from "#/lib/window-manager";
import type { WindowId } from "#/lib/window-manager";

import styles from "./desktop-icons.module.css";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const ICONS_BY_ID = new Map(ICONS.map((iconDefinition) => [iconDefinition.id, iconDefinition]));

export function DesktopIcons({ onZoomRect }: { onZoomRect: (zoom: { windowId: WindowId; from: Rect }) => void }) {
  const content = useWindowContent();
  const focusedWindow = useFocusedWindow();
  const { open, focusDesktop } = useWindowActions();
  const positions = useIconPositions();
  const isBootSequenceComplete = useIsBootSequenceComplete();
  const flash = useActivationFlash<string>();
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const containerSize = useElementSize(layerRef);
  const iconsRef = useRef<Record<string, HTMLDivElement | null>>({});

  // Only a press on the empty desktop clears the selection. A press on a window or on
  // the menu bar leaves it standing. The desktop stops showing a selection when it does
  // not hold keyboard focus.
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
  const openDestinationRoutes = new Set(Object.values(content).map(({ route }) => destinationRouteOf(route)));
  const container = {
    width: containerSize.width || (typeof window === "undefined" ? 0 : window.innerWidth),
    height: containerSize.height || (typeof window === "undefined" ? 0 : window.innerHeight),
  };

  // Nothing is placed until `positions` has been read on the client which keeps the icons out of the server render.
  const placements: Array<IconPlacement & { iconDefinition: Icon }> = positions
    ? resolveIconPlacements(ICON_IDS, positions, container, ICON_LAYOUT).flatMap((placement) => {
        const iconDefinition = ICONS_BY_ID.get(placement.id);
        return iconDefinition ? [{ ...placement, iconDefinition }] : [];
      })
    : [];

  function selectIcon(id: string) {
    setSelectedIconId(id);
    focusDesktop(); // Activate the desktop so the selection is shown and the arrow keys move it.
    iconsRef.current[id]?.focus();
  }

  function openIcon(iconDefinition: Icon) {
    flash.start(iconDefinition.id);

    if (iconDefinition.kind === "download") {
      downloadFile(iconDefinition.downloadUrl);
      return;
    }

    // The zoom rect grows towards a window that is not on the desktop yet.
    // A window that is already open only changes what it shows.
    const windowId = resolveWindow(iconDefinition.route)?.id;
    const element = iconsRef.current[iconDefinition.id];

    if (element && windowId && !content[windowId]) {
      onZoomRect({ windowId, from: relativeRect(element) });
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

    const isEnterOrSpace = event.key === "Enter" || event.key === " ";
    const isAltO = event.altKey && event.code === "KeyO";

    if (isEnterOrSpace || isAltO) {
      event.preventDefault();
      playClick();
      openIcon(iconDefinition);
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
    // The layer always renders so its ref exists for measurement.
    <div ref={layerRef} className={cx(styles.layer, isBootSequenceComplete && styles.ready)}>
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
          open={iconDefinition.kind === "collection" && openDestinationRoutes.has(iconDefinition.route)}
          selected={flash.isHighlighted(id, focusedWindow === null && selectedIconId === id)}
          onSelect={() => selectIcon(id)}
          onOpen={() => openIcon(iconDefinition)}
          onMoveStart={(nextX, nextY) => moveIcon(id, positionFromDrop({ x: nextX, y: nextY }, container, ICON_LAYOUT))}
          onMoveEnd={commitIconPositions}
          onKeyDown={(event) => onIconKeyDown(event, iconDefinition)}
        />
      ))}
    </div>
  );
}
