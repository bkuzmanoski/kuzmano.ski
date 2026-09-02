import { useEffect, useEffectEvent, useRef, useState } from "react";

import { DesktopIcon } from "#/components/desktop-icon";
import { ICON_LAYOUT } from "#/config/desktop";
import { DESTINATION_ORDER } from "#/config/navigation";
import { playClick } from "#/lib/audio/sounds";
import { useIsBootSequenceComplete } from "#/lib/boot-sequence/use-is-boot-sequence-complete";
import { cx } from "#/lib/class-names";
import type { Rect } from "#/lib/geometry";
import { useActivationFlash } from "#/lib/hooks/use-activation-flash";
import { useElementSize } from "#/lib/hooks/use-element-size";
import type { Icon, IconPlacement } from "#/lib/icons/icon";
import { positionFromDrop, resolveIconPlacements } from "#/lib/icons/layout";
import { adjacentIconId } from "#/lib/icons/navigation";
import { createIconPositionsStore } from "#/lib/icons/positions";
import { isArrowKey } from "#/lib/keys";
import type { ArrowKey } from "#/lib/keys";
import { followLink } from "#/lib/link";
import { useFocusedWindow, useWindowActions, useWindowContent } from "#/lib/window-manager/context";
import type { WindowId } from "#/lib/window-manager/window";
import { DESTINATIONS } from "#/site/navigation";
import { isDestinationOpen, resolveWindow } from "#/site/windows";

import styles from "./desktop-icons.module.css";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const ICONS: Array<Icon> = DESTINATION_ORDER.map((id) => ({
  id,
  kind: DESTINATIONS[id].type,
  label: DESTINATIONS[id].title,
  route: DESTINATIONS[id].route,
}));
const ICON_IDS = ICONS.map((iconDefinition) => iconDefinition.id);
const ICONS_BY_ID = new Map(ICONS.map((iconDefinition) => [iconDefinition.id, iconDefinition]));

const { useIconPositions, moveIcon, commitIconPositions } = createIconPositionsStore(ICON_IDS, ICON_LAYOUT);

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

  // Read from the DOM rather than from a ref map, so an icon does not have
  // to take a ref callback that its parent rebuilds on every render.
  const iconElement = (id: string) => layerRef.current?.querySelector<HTMLAnchorElement>(`[data-icon="${id}"]`);

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
  const openWindowRoutes = Object.values(content).map(({ route }) => route);
  const container = {
    width: containerSize.width || (typeof window === "undefined" ? 0 : window.innerWidth),
    height: containerSize.height || (typeof window === "undefined" ? 0 : window.innerHeight),
  };

  const placements: Array<IconPlacement & { iconDefinition: Icon }> = positions
    ? resolveIconPlacements(ICON_IDS, positions, container, ICON_LAYOUT).flatMap((placement) => {
        const iconDefinition = ICONS_BY_ID.get(placement.id);
        return iconDefinition ? [{ ...placement, iconDefinition }] : [];
      })
    : [];

  // The handlers below read the layout through this ref rather than capturing it from render.
  // Both the placements and container are rebuilt on every frame of a drag, so capturing either
  // would recreate the handlers and re-render every icon they are passed to.
  const layoutRef = useRef({ placements, container });

  useEffect(() => {
    layoutRef.current = { placements, container };
  });

  function selectIcon(iconDefinition: Icon) {
    setSelectedIconId(iconDefinition.id);
    focusDesktop(); // Activate the desktop so the selection is shown and the arrow keys move it.
    iconElement(iconDefinition.id)?.focus();
  }

  function openIcon(iconDefinition: Icon) {
    flash.start(iconDefinition.id);

    if (iconDefinition.kind === "download") {
      followLink(iconElement(iconDefinition.id));
      return;
    }

    // The zoom rect grows towards a window that is not on the desktop yet.
    // A window that is already open only changes what it shows.
    const windowId = resolveWindow(iconDefinition.route)?.id;
    const element = iconElement(iconDefinition.id);

    if (element && windowId && !content[windowId]) {
      onZoomRect({ windowId, from: relativeRect(element) });
    }

    open(iconDefinition.route);
  }

  function moveSelection(fromId: string | null, key: ArrowKey) {
    const current = layoutRef.current.placements;
    const nextId = (fromId === null ? current[0]?.id : adjacentIconId(current, fromId, key)) ?? null;
    const nextIcon = nextId === null ? undefined : ICONS_BY_ID.get(nextId);

    if (nextIcon) {
      selectIcon(nextIcon);
    }
  }

  function moveIconTo(iconDefinition: Icon, x: number, y: number) {
    moveIcon(iconDefinition.id, positionFromDrop({ x, y }, layoutRef.current.container, ICON_LAYOUT));
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

  const restoreFocusToSelection = useEffectEvent(() => {
    const activeElement = document.activeElement;

    if (selectedIconId === null || (activeElement !== null && activeElement !== document.body)) {
      return;
    }

    iconElement(selectedIconId)?.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (focusedWindow === null) {
      restoreFocusToSelection();
    }
  }, [focusedWindow]);

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
          iconDefinition={iconDefinition}
          x={x}
          y={y}
          cellSize={ICON_LAYOUT.cellSize}
          open={iconDefinition.kind === "collection" && isDestinationOpen(iconDefinition.route, openWindowRoutes)}
          selected={flash.isHighlighted(id, focusedWindow === null && selectedIconId === id)}
          tabIndex={tabStop === id ? 0 : -1}
          onSelect={selectIcon}
          onOpen={openIcon}
          onMoveStart={moveIconTo}
          onMoveEnd={commitIconPositions}
          onKeyDown={onIconKeyDown}
        />
      ))}
    </div>
  );
}
