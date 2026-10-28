import type { WindowId } from "#/lib/window-manager/window.ts";

interface FeatureRouteSpec {
  route: string;
  title: string;
  description: string;
  isIndexed: boolean; // `false` marks the document noindex and leaves the route out of the sitemap.
}

/** Routes for UI rather than content files, keyed by the ID of the window each one opens. */
export const FEATURE_ROUTE_SPECS = {
  contact: { route: "/contact", title: "Contact", description: "A form for sending a message.", isIndexed: true },
  controlPanel: { route: "/control-panel", title: "Control Panel", description: "", isIndexed: false },
} as const satisfies Partial<Record<WindowId, FeatureRouteSpec>>;

export type FeatureRouteId = keyof typeof FEATURE_ROUTE_SPECS;
