import { DESTINATIONS, DESTINATION_ORDER } from "#/config/navigation";
import type { Icon, IconLayout } from "#/lib/icon";
import { createIconPositionsStore } from "#/lib/icon-positions";

export const ICONS: Array<Icon> = [
  ...DESTINATION_ORDER.map((id) => ({
    id,
    kind: DESTINATIONS[id].iconKind,
    label: DESTINATIONS[id].title,
    route: DESTINATIONS[id].route,
  })),
];

export const ICON_IDS = ICONS.map((iconDefinition) => iconDefinition.id);

export const ICON_LAYOUT: IconLayout = {
  cellSize: 72,
  position: { top: 24, right: 32 },
  spacing: 96,
};

export const ICON_POSITIONS_STORAGE_KEY = "icon-positions";

export const { useIconPositions, moveIcon, commitIconPositions } = createIconPositionsStore(
  ICON_IDS,
  ICON_LAYOUT,
  ICON_POSITIONS_STORAGE_KEY,
);
