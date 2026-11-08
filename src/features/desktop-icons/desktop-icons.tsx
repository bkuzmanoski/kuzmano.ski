import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { MenuItem } from "#/components/menu-items.ts";
import { Menu } from "#/components/menu.tsx";
import { ICON_LAYOUT } from "#/config/desktop.ts";
import { DESTINATION_ORDER } from "#/config/navigation.ts";
import { useOpenWindowFrom } from "#/features/window-manager/use-open-window-from.ts";
import { playClickSound } from "#/lib/audio/sounds.ts";
import { cx } from "#/lib/class-names.ts";
import type { Icon, IconPlacement } from "#/lib/desktop-icons/icon.ts";
import { positionFromDrop, resolveIconPlacements } from "#/lib/desktop-icons/layout.ts";
import { adjacentIconId } from "#/lib/desktop-icons/navigation.ts";
import { createIconPositionsStore } from "#/lib/desktop-icons/positions.ts";
import { useActivationFlash } from "#/lib/hooks/use-activation-flash.ts";
import { useElementSize } from "#/lib/hooks/use-element-size.ts";
import { useEventListeners } from "#/lib/hooks/use-event-listeners.ts";
import { activateOnKeyPress, isArrowKey } from "#/lib/keys.ts";
import type { ArrowKey } from "#/lib/keys.ts";
import { followLink } from "#/lib/link.ts";
import type { ContextMenuPress } from "#/lib/menu/use-context-menu-press.ts";
import { useContextMenuPress } from "#/lib/menu/use-context-menu-press.ts";
import { useIsFromPointerPress } from "#/lib/press/use-is-from-pointer-press.ts";
import { useIsStartupSequenceComplete } from "#/lib/startup-sequence/lifecycle.ts";
import {
  useFocusedWindow,
  useNotFoundRoute,
  useWindowActions,
  useWindowContent,
} from "#/lib/window-manager/context.ts";
import { DESTINATIONS } from "#/site/navigation.ts";
import { isDestinationOpen } from "#/site/windows.ts";

import { DesktopIcon } from "./desktop-icon.tsx";
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

const { useIconPositions, moveIcon, commitIconPositions, resetIconPositions } = createIconPositionsStore(
  ICON_IDS,
  ICON_LAYOUT,
);

const DESKTOP_MENU_ITEMS: Array<MenuItem> = [{ kind: "action", label: "Clean Up Desktop", action: resetIconPositions }];

const isEmptyDesktop = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.dataset.desktop !== undefined;

export function DesktopIcons() {
  const content = useWindowContent();
  const focusedWindow = useFocusedWindow();
  const notFoundRoute = useNotFoundRoute();
  const { focusDesktop } = useWindowActions();
  const isFromPointerPress = useIsFromPointerPress();
  const openWindowFrom = useOpenWindowFrom();
  const positions = useIconPositions();
  const isStartupSequenceComplete = useIsStartupSequenceComplete();
  const activationFlash = useActivationFlash<string>();
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [desktopMenu, setDesktopMenu] = useState<{ press: ContextMenuPress; focusesFirstItem: boolean } | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const containerSize = useElementSize(layerRef);

  useContextMenuPress({
    isTarget: isEmptyDesktop,
    onPress: (press) => setDesktopMenu({ press, focusesFirstItem: !isFromPointerPress() }),
  });

  // Only a press on the empty desktop clears the selection. A press on a window or on the menu bar does not clear it.
  // The desktop stops showing a selection when it does not hold keyboard focus.
  useEventListeners("document", {
    pointerdown: (event) => {
      if (isEmptyDesktop(event.target)) {
        setSelectedIconId(null);
      }
    },
  });

  // Read from the DOM rather than from a ref map, so an icon does not have to take a ref callback that its parent
  // rebuilds on every render.
  const iconElement = (id: string) => layerRef.current?.querySelector<HTMLAnchorElement>(`[data-icon="${id}"]`);

  const tabStop = selectedIconId ?? ICONS[0]?.id;
  const openWindowRoutes = Object.values(content).map(({ route }) => route);
  const effectiveContainerSize = {
    width: containerSize.width || (typeof window === "undefined" ? 0 : window.innerWidth),
    height: containerSize.height || (typeof window === "undefined" ? 0 : window.innerHeight),
  };

  const placements: Array<IconPlacement & { iconDefinition: Icon }> = positions
    ? resolveIconPlacements(ICON_IDS, positions, effectiveContainerSize, ICON_LAYOUT).flatMap((placement) => {
        const iconDefinition = ICONS_BY_ID.get(placement.id);
        return iconDefinition ? [{ ...placement, iconDefinition }] : [];
      })
    : [];

  // The handlers below read the layout through this ref rather than capturing it from render. Both the placements and
  // container are rebuilt on every frame of a drag, so capturing either would recreate the handlers and re-render every
  // icon they are passed to.
  const layoutRef = useRef({ placements, container: effectiveContainerSize });

  useEffect(() => {
    layoutRef.current = { placements, container: effectiveContainerSize };
  });

  function selectIcon(iconDefinition: Icon) {
    setSelectedIconId(iconDefinition.id);
    focusDesktop(); // Activate the desktop so the selection is shown and the arrow keys move it.
    iconElement(iconDefinition.id)?.focus();
  }

  function openIcon(iconDefinition: Icon) {
    activationFlash.start(iconDefinition.id);

    if (iconDefinition.kind === "download") {
      followLink(iconElement(iconDefinition.id));
      return;
    }

    openWindowFrom(iconDefinition.route, iconElement(iconDefinition.id));
  }

  function moveSelection(fromId: string | null, key: ArrowKey) {
    const currentPlacements = layoutRef.current.placements;
    const nextId =
      (fromId === null ? currentPlacements[0]?.id : adjacentIconId(currentPlacements, fromId, key)) ?? null;
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

    function openWithKeyboard() {
      playClickSound();
      openIcon(iconDefinition);
    }

    if (activateOnKeyPress(event, openWithKeyboard)) {
      return;
    }

    if (event.altKey && event.code === "KeyO") {
      event.preventDefault();

      if (!event.repeat) {
        openWithKeyboard();
      }
    }
  }

  // The focus falls to the body when the focused element is removed with its window or its alert, or is made inert with
  // its window. A selected icon is focused again whatever closed the window. Focusing the icon that is the tab stop
  // selects it, so it is focused only after a keyboard action; after a pointer press, the arrow keys already move the
  // selection from the body.
  const restoreFocusToDesktop = useEffectEvent(() => {
    const { activeElement } = document;
    const isFocusLost =
      activeElement === null || activeElement === document.body || activeElement.closest("[inert]") !== null;
    const iconId = isFromPointerPress() ? selectedIconId : tabStop;

    if (isFocusLost && iconId) {
      iconElement(iconId)?.focus({ preventScroll: true });
    }
  });

  const isDesktopActive = focusedWindow === null && notFoundRoute === null;

  // The effect runs only when `isDesktopActive` changes, so the comparison with the previous value skips just the run
  // on mount: a page that loads on the empty desktop leaves the focus on the body rather than selecting an icon.
  // Comparing, rather than skipping the first run, also holds when Strict Mode runs the effect twice on mount.
  const wasDesktopActiveRef = useRef(isDesktopActive);

  useEffect(() => {
    const wasDesktopActive = wasDesktopActiveRef.current;

    wasDesktopActiveRef.current = isDesktopActive;

    if (isDesktopActive && !wasDesktopActive) {
      restoreFocusToDesktop();
    }
  }, [isDesktopActive]);

  useEventListeners(
    "window",
    {
      keydown: (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.target !== document.body) {
          return;
        }

        if (isArrowKey(event.key)) {
          event.preventDefault();
          moveSelection(selectedIconId, event.key);
        }
      },
    },
    { enabled: focusedWindow === null && isStartupSequenceComplete },
  );

  return (
    // The layer always renders so its ref exists for measurement.
    <div ref={layerRef} className={cx(styles.layer, isStartupSequenceComplete && styles.ready)}>
      {placements.map(({ id, iconDefinition, x, y }) => (
        <DesktopIcon
          key={id}
          iconDefinition={iconDefinition}
          x={x}
          y={y}
          cellSize={ICON_LAYOUT.cellSize}
          open={iconDefinition.kind === "collection" && isDestinationOpen(iconDefinition.route, openWindowRoutes)}
          selected={activationFlash.highlightOf(id) ?? (focusedWindow === null && selectedIconId === id)}
          tabIndex={tabStop === id ? 0 : -1}
          onSelect={selectIcon}
          onOpen={openIcon}
          onMoveStart={moveIconTo}
          onMoveEnd={commitIconPositions}
          onKeyDown={onIconKeyDown}
        />
      ))}
      {desktopMenu && (
        <Menu
          items={DESKTOP_MENU_ITEMS}
          opener={{
            kind: "point",
            position: desktopMenu.press.origin,
            pointerType: desktopMenu.press.pointerType,
            label: "Desktop",
          }}
          isPointerHeld={desktopMenu.press.isPointerHeld}
          focusesFirstItem={desktopMenu.focusesFirstItem}
          onClose={() => setDesktopMenu(null)}
        />
      )}
    </div>
  );
}
