// Imports only leaf modules because `/vite.config.ts` loads this module through `/build`.
import { PAGE_SLUGS } from "#/config/content.ts";
import { FEATURE_ROUTE_SPECS } from "#/config/feature-routes.ts";
import type { FeatureRouteId } from "#/config/feature-routes.ts";
import { pageRoute } from "#/lib/content/paths.ts";
import { isOneOf } from "#/lib/guards.ts";

import type { Collection } from "./catalog.ts";

export { collectionRoute, entryRoute, isRootPath, pageRoute, parseContentPath } from "#/lib/content/paths.ts";
export type { ContentPath } from "#/lib/content/paths.ts";

/** The route of a page, with a `collection` of `null`, or of a collection entry. */
export const entryRouteOf = ({ collection, slug }: { collection: Collection | null; slug: string }) =>
  collection ? collection.routeOf(slug) : pageRoute(slug);

export const FEATURE_ROUTE_IDS = Object.keys(FEATURE_ROUTE_SPECS) as Array<FeatureRouteId>;
export const FEATURE_ROUTES: Array<string> = FEATURE_ROUTE_IDS.map((id) => FEATURE_ROUTE_SPECS[id].route);

/** Returns the ID of the feature route that shadows a top-level segment, if any. */
export const featureRouteIdFor = (segment: string): FeatureRouteId | undefined =>
  FEATURE_ROUTE_IDS.find((id) => FEATURE_ROUTE_SPECS[id].route === pageRoute(segment));

/**
 * Returns whether `PAGE_SLUGS` declares a page. Undeclared published pages are served with `noindex` and omitted from
 * the sitemap.
 */
export const isDeclaredPageSlug = isOneOf(PAGE_SLUGS);
