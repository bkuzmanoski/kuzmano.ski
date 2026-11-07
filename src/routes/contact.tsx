import { createFileRoute } from "@tanstack/react-router";

import { featureRouteHead } from "#/site/metadata.ts";

/**
 * Declared statically so it outranks `/$segment`, which resolves a segment to a collection or a page. The contact
 * window has no document behind it, so this route exists only to supply head tags.
 */
export const Route = createFileRoute("/contact")({
  head: () => featureRouteHead("contact"),
  component: () => null,
});
