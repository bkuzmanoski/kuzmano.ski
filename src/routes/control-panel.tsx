import { createFileRoute } from "@tanstack/react-router";

import { featureRouteHead } from "#/site/metadata.ts";

/**
 * Declared statically so it outranks `/$segment`, which resolves a segment to a collection or a page. The control panel
 * window has no document behind it, so this route exists only to supply head tags.
 */
export const Route = createFileRoute("/control-panel")({
  head: () => featureRouteHead("controlPanel"),
  component: () => null,
});
