import { DESTINATION_ORDER, DESTINATION_SPECS } from "#/config/navigation";
import type { DestinationId, DestinationSpec } from "#/config/navigation";
import type { Destination } from "#/lib/window-manager";

import { pages } from "./catalog";

function titleOf(id: DestinationId, spec: DestinationSpec): string {
  if (spec.type !== "entry") {
    return spec.title;
  }

  try {
    return pages.frontmatterOf(id)?.title ?? id;
  } catch {
    return id; // Throwing here would tear down the desktop before the error boundary exists; use the slug as a fallback.
  }
}

export const DESTINATIONS = Object.fromEntries(
  DESTINATION_ORDER.map((id) => {
    const spec: DestinationSpec = DESTINATION_SPECS[id];
    return [id, { type: spec.type, route: spec.route, title: titleOf(id, spec) }];
  }),
) as Record<DestinationId, Destination>;
