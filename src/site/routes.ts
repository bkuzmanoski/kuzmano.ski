import { CONTACT_ROUTE } from "#/config/contact.ts";
import { pageRoute } from "#/lib/content/paths.ts";

export { collectionRoute, entryRoute, isRootPath, pageRoute, parseContentPath } from "#/lib/content/paths.ts";
export type { ContentPath } from "#/lib/content/paths.ts";

/** Routes for UI rather than content files. */
export const FEATURE_ROUTES: Array<string> = [CONTACT_ROUTE];

/** Returns the feature route shadowed by a top-level segment, if any. */
export const featureRouteFor = (segment: string): string | undefined =>
  FEATURE_ROUTES.find((route) => route === pageRoute(segment));
