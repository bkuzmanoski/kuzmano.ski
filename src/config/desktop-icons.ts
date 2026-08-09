import { DESTINATIONS, DESTINATION_ORDER } from "#/config/navigation";
import type { Icon, IconLayout } from "#/lib/icon";

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
