import { CONTACT_ROUTE } from "#/config/contact.ts";
import { PAGE_SLUGS } from "#/config/content.ts";
import type { PageSlug } from "#/config/content.ts";
import { pageRoute } from "#/lib/content/paths.ts";

export { collectionRoute, entryRoute, isRootPath, pageRoute, parseContentPath } from "#/lib/content/paths.ts";
export type { ContentPath } from "#/lib/content/paths.ts";

/** Routes for UI rather than content files. */
export const FEATURE_ROUTES: Array<string> = [CONTACT_ROUTE];

/** Returns the feature route shadowed by a top-level segment, if any. */
export const featureRouteFor = (segment: string): string | undefined =>
  FEATURE_ROUTES.find((route) => route === pageRoute(segment));

/**
 * Whether `PAGE_SLUGS` declares a page. A published page it omits is still served, but is marked
 * noindex and left out of the sitemap.
 */
export const isDeclaredPageSlug = (slug: string): slug is PageSlug =>
  (PAGE_SLUGS as ReadonlyArray<string>).includes(slug);
