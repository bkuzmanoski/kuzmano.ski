import type { WindowId } from "#/lib/window-manager/window.ts";

interface FeatureRouteSpec {
  route: string;
  title: string;
  description: string;
  /** `false` marks the document noindex and leaves the route out of the sitemap. */
  isIndexed: boolean;
}

/** Routes for UI rather than content files, keyed by the ID of the window each one opens. */
export const FEATURE_ROUTE_SPECS = {
  contact: {
    route: "/contact",
    title: "Contact",
    description: "Send Brian a message about software design and development work, collaborations, or anything else.",
    isIndexed: true,
  },
  controlPanel: {
    route: "/control-panel",
    title: "Control Panel",
    description: "Change the site's theme, switch between light and dark appearance, and turn sound effects on or off.",
    isIndexed: false,
  },
} as const satisfies Partial<Record<WindowId, FeatureRouteSpec>>;

export type FeatureRouteId = keyof typeof FEATURE_ROUTE_SPECS;
