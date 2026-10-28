import { createFileRoute } from "@tanstack/react-router";

import { FEATURE_ROUTE_SPECS } from "#/config/feature-routes.ts";
import { documentHead } from "#/site/metadata.ts";

/**
 * Declared statically so it outranks `/$segment`, which resolves a segment to a collection or a page.
 * The control panel window has no document behind it, so this route exists only to supply head tags.
 */
export const Route = createFileRoute("/control-panel")({
  head: () => {
    const { route, title, description, isIndexed } = FEATURE_ROUTE_SPECS.controlPanel;
    return documentHead({ title, description, path: route, noindex: !isIndexed });
  },
  component: () => null,
});
